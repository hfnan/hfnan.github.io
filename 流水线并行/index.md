# 流水线并行


## 优化目标

做分布式训练的总体目标是什么？

-   **能训练更大的模型。** 理想状况下，模型的大小和GPU的数量成线性关系。即GPU量提升x倍，模型大小也能提升x倍。

-   **能更快地训练模型。** 理想状况下，训练的速度和GPU的数量成线性关系。即GPU量提升x倍，训练速度也能提升x倍。

这是目标，也是难点。难点在于：

-   训练更大的模型时，每块GPU里不仅要存模型参数，还要存中间结果（用来做Backward）。而更大的模型意味着需要更多的训练数据，进一步提高了中间结果的大小。加重了每块GPU的内存压力。我们将在下文详细分析这一点。（**对应着GPU中的内存限制**）
-   网络通讯开销。数据在卡之间进行传输，是需要通讯时间的。不做设计的话，这个通讯时间可能会抹平多卡本身带来的训练速度提升。（**对应着GPU间的带宽限制**）

## 1 朴素的流水线并行

当你有一个单卡装不下的大模型时，一个直接的解决办法是，把模型隔成不同的层，每一层都放到一块GPU上。此时，模型做一轮forward和backward的过程如下：

<img src="/image-20250115115022087.png" alt="image-20250115115022087" style="zoom: 67%;" />

其中下标表示batch编号，这里只有一个batch，因此下标都是0。每一行表示一个GPU，每一列表示timestep。

这张图的含义是：我在GPU0上做完一次forward，然后将GPU0上最后一层的输入传给GPU1，继续做forward，直到四块GPU都做完forward后，我再依次做backward。等把四块GPU上的backward全部做完后，最后一个时刻我统一更新每一层的梯度。

这样做确实能训更大的模型了，但也带来了两个问题：

-   **GPU利用度不够。**
-   **中间结果占据大量内存。**



## 2 GPipe

### 2.1 切分micro-batch

将输入的数据mini-batch再细分为micro-batch，在GPU间流水训练，以减少流水线bubble的占比。

<img src="/image-20250115205300369.png" alt="image-20250115205300369" style="zoom:67%;" />

图中，每个函数的第一个下标表示GPU编号，第二个下标表示micro-batch编号。若micro-batch的数量为$\boldsymbol{M}$，使用GPU的数量为$\boldsymbol{K}$，则GPipe通过实验证明，当 $\boldsymbol{M \ge 4 \times K}$ 时，bubble产生的空转时间占比对最终训练时长的影响是微小的，可以忽略不计。

在前向计算中，$\boldsymbol{M}$ 个micro-batch流水地通过$\boldsymbol{K}$ 个GPU。在反向计算中，每个micro-batch的梯度基于forward的模型参数来计算，在所有micro-batch的梯度计算完成后，将梯度累加起来并用于更新所有GPU上的模型参数。



### 2.2 re-materialization

为了减少激活内存占用，GPipe在forward过程中，每个GPU只保存当前stage最后的输出，而不保存stage内部层间的activation。在backward时， 每个GPU再重新计算一遍forward来得到梯度。

采用这种方法，对于层数为$\boldsymbol{L}$，mini-batch size为$\boldsymbol{N}$，micro-batch的数量为$\boldsymbol{M}$，使用GPU的数量为$\boldsymbol{K}$ 的GPipe流水线并行来说，峰值显存占用从$\boldsymbol{O(N \times L)}$ 减小到$\boldsymbol{O(N + \frac{L}{K} \times \frac{N}{M})}$ 。



### 2.3 GPipe流水线存在的问题

-   反向计算在全部前向计算完成后才开始，造成bubble时间。
-   需要缓存$\boldsymbol{M}$ 份activation，显存占用较高。



## 3 PipeDream

### 3.1 1F1B

PipeDream的1F1B策略既可以减少bubble，又能缓解激活显存占用问题。

在开始阶段（startup phase），输入若干micro-batch（micro-batch的数量是在稳定阶段下保持流水线满负荷所允许的最小micro-batch数量），进行前向计算。当最后一个stage完成一个micro-batch的前向计算后，就立即进行该micro-batch的反向计算，随后交替地执行micro-batch的前向和反向计算。不是等待所有micro-batches全部执行完前向计算后再执行反向计算，而是在一个micro-batch前向计算完成后就立即执行反向计算，这样就可以尽早地开始执行反向计算，从而减少每个activation在显存中的保留时间。

在稳定阶段（steady phase），每个GPU交替执行前向和反向计算，这样使得每个GPU上都会有一个micro-batch正在处理，没有GPU空闲，从而保证获得资源的高利用率。

<img src="/image-20250116135838009.png" alt="image-20250116135838009" style="zoom: 80%;" />

在通信方面，与GPipe的同步通信不同，PipeDream各个stage之间的通信与forward和backward计算是异步的，可以有效进行计算和通信重叠。如下图所示，当一个stage前向计算完成后，将activation传给后一个stage的通信与下一个time step进行的反向计算重叠。当反向计算完成后，将gradient传给前一个stage的通信与下一个time step的前向计算重叠。

<img src="/image-20250122195414379.png" alt="image-20250122195414379" style="zoom:80%;" />

PipeDream的权重更新是在每个mini-batch完成一次forward和backward计算后立即更新的。但这种流水线会导致forward和backward使用的参数版本不一致。比如上面流水线的图，对于Machine 1（stage 1）mini-batch 5 的前向计算是在mini-batch 1完成计算后更新的参数，而mini-batch 5的反向计算是在mini-batch 2、3、4更新后的参数。PipeDream提出了两种方法解决参数不一致的问题。

### 3.2 Weight Stashing 和 Vertical Sync

**Weight stashing** 为每个活跃的mini-batch维护了一个权重版本。当一个mini-batch进入流水线执行前向计算时，每个stage使用最新版本的权重进行计算，并将该版本权重作为该mini-batch的中间状态的一部分保存。当执行该mini-batch的反向计算时，使用同版本的权重来计算梯度。Weight stashing 确保在一个stage的计算中，一个mini-batch的前向和后向计算使用的是相同版本的权重，但并不对不同stage上使用权重的一致性有保证。

**Vertical Sync** 确保了跨stage的权重一致性。每个mini-batch在所有stage上的前向和反向计算均使用它进入流水线时的最新权重，比如mini-batch 5 的全程计算均使用mini-batch 1 训练更新后的权重参数。

Weight stashing 对有效训练有很大作用，而根据PipeDream的实验，是否使用Vertical Sync 对训练的影响可以忽略不计。



## 4 Interleaved 1F1B

Interleaved 1F1B使用了Virtual Pipeline Parallelism的方法，每个流水线阶段被进一步细分为更多的虚拟阶段（Virtual stage），每个实际GPU负责处理多个虚拟阶段。micro-batches在虚拟阶段中计算。

<img src="/image-20250123125733581.png" alt="image-20250123125733581" style="zoom:80%;" />



## X 参考

[图解大模型训练之：流水线并行（Pipeline Parallelism），以Gpipe为例](https://zhuanlan.zhihu.com/p/613196255)

[GPipe: Efficient Training of Giant Neural Networks using Pipeline Parallelism](https://arxiv.org/abs/1811.06965)

[PipeDream: Fast and Efficient Pipeline Parallel DNN Training](https://arxiv.org/abs/1806.03377)

[[源码解析] 深度学习流水线并行 PipeDream(6)--- 1F1B策略](https://www.cnblogs.com/rossiXYZ/p/15272831.html#13-1f1b%E6%B5%81%E6%B0%B4%E7%BA%BF)

