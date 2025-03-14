# 数据并行


数据并行的核心思想是：在每个GPU上都拷贝一份完整模型，每个模型副本各自输入一份数据，计算一份梯度，最后对梯度进行累加来更新整体模型。理念并不复杂，但到了大模型场景，如何处理巨大的存储和GPU之间的通信，就是系统设计要考虑的重点了。

## 1 数据并行（DP）

### 1.1 整体架构

是最早的数据并行模式，采用参数服务器（Parameter Server）架构，实际用于单机多卡。

典型的数据并行流程如下：

1.   **模型复制**：数据并行使用多个计算节点，每个计算节点保存一份相同的完整模型副本。
2.   **数据分割**：将训练数据batch均匀分割成多个mini-batches，每个mini-batch分配给一个计算节点。
3.   **前向和反向计算**：每个计算节点使用其分配到的mini-batch进行前向和反向计算，得到一份梯度。
4.   **梯度聚合**：每个计算节点将自己计算的梯度发送到一个Server节点（一般选择一个计算节点同时作为Server），执行梯度聚合操作。这里的聚合操作一般指梯度累加，也可由用户自定义。
5.   **参数更新**：Server节点完成梯度聚合后，用完整的梯度更新模型参数，再将更新后的参数广播给所有计算节点。

将梯度聚合再下发的操作，称为All-Reduce。

<img src="/image-20250122232655336.png" alt="image-20250122232655336" style="zoom:80%;" />

### 1.2 参数服务器

参数服务器（Parameter Server）是一种分布式系统架构，专门用于大规模机器学习任务。

在该架构中包含两个角色：Worker和Server。Worker充当计算节点负责模型训练，而Server负责梯度聚合和参数更新。在实际应用中，为了尽量减少通信量，一般可选择一个Worker同时作为Server，比如可以把梯度发到GPU0上做聚合。

为了保持模型一致性，一般有两种方法：

-   将模型参数保存在一个集中的节点上，当一个计算节点要进行模型训练时，可从集中节点获取参数，进行模型训练，然后将更新后的模型推送会集中节点。由于所有计算节点都从同一个集中节点获取参数，因此可以保证模型一致性。
-   每个计算节点都保存模型参数的副本，因此要定期强制同步模型参数副本。每个计算节点使用自己的训练数据分区来训练本地模型副本。在每个训练迭代后，由于使用不同的输入数据进行训练，存储在不同计算节点上的模型副本可能会有所不同。因此，每一次训练迭代后插入一个全局同步的步骤，这将对不同计算节点上的参数进行平均，以便以完全分布式的方式保证模型的一致性，即All-Reduce范式。



### 1.3 通信瓶颈与梯度异步更新

DP的框架在实战中有两个主要问题：

-   **存储开销大**。每块GPU上都保存了一份完整的模型，造成冗余。
-   **通信开销大**。Server需要和每一个Worker进行梯度传输。当Server和Worker不在一台机器上时，Server的带宽将会成为整个系统的计算效率瓶颈。

**梯度异步更新**要求每个GPU计算完梯度后，无需等待其他GPU更新，立即更新整体权重。并且，每个GPU并不空置等待权重更新的结果，而是直接使用未更新的权重参数进行下一轮mini-batch训练。所以其本质上相当于增加了batch size，在SGD下会减缓模型的收敛速度，并且由于异步会产生复杂的梯度问题。



## 2 分布式数据并行（DDP）

分布式数据并行，采用Ring All-Reduce的通信方式，实际中多用于多机场景。

### 2.1 Ring All-Reduce

PS架构中，当worker数量较多时，PS节点的网络带宽将成为系统的瓶颈。

All-Reduce架构是指不带有参数服务器的分布式集群架构。在该架构中，集群的所有节点都作为worker来执行计算操作，该架构会在每个batch训练完成后，使用All-Reduce算法在所有worker节点间进行模型变量的同步更新。

传统的同步更新方法（各个GPU卡算好梯度，求和算平均的方式），在融合梯度时，会产生巨大的通信数据量，这种通信压力往往在模型参数量很大时，显得很明显。因此我们需要找到一种方法，来解决同步更新的网络瓶颈问题。其中最具代表性的一种方法就是Ring All-Reduce。

Ring All Reduce是一种以环状拓扑为基础的通信系统。Ring All-Reduce架构中各个设备都是worker，没有中心节点来聚合所有worker计算的梯度。Ring All-Reduce算法将 device 放置在一个逻辑环路（logical ring）中。每个 device 从上行的device 接收数据，并向下行的 deivce 发送数据，因此可以充分利用每个 device 的上下行带宽。

<img src="/image-20240728144553839.png" alt="image-20240728144553839" style="zoom:80%;" />

梯度聚合过程分为两个阶段：

-   **Reduce-Scatter**：GPU会逐步交换彼此的梯度并聚合，最后每个GPU会包含完成聚合梯度的一部分。
-   **All-Gather**：GPU会逐步交换彼此不完整的聚合梯度，最后所有GPU都会得到完整的聚合梯度。

#### Reduce-Scatter

1.   每个节点把本设备上的数据分成N块，N是架构中worker的数目。
2.   在一次传输和接收结束后，在每个节点上累加了其他节点的一个块的数据。这样的数据传输模式直到阶段结束。
3.   每个节点上都有一个包含最后结果的块，这个块的数据是所有节点相应位置块数据之和。

<img src="/image-20250123132832614.png" alt="image-20250123132832614" style="zoom:80%;" />

#### All-Gather

1.   All Gather阶段总共包含N-1次数据传输，不同的是，All Gather阶段并不需要将接收到的值进行累加，而是直接使用接收到的块内数值代替原来块中的值。在一次传输后，每个节点含有最终结果的块增加一个。
2.   继续这个传输过程直到结束，使得每个节点都包含了全部的数据结果。

<img src="/image-20250123132917272.png" alt="image-20250123132917272" style="zoom:80%;" />

### 2.2 Ring All-Reduce通信量分析

假设模型参数大小为 $\Phi$ ，GPU个数为 $N$ 。则梯度大小也为 $\Phi$ ，每个梯度块的大小为 $\frac{\Phi}{N}$ 。对单卡GPU来说（只计算其发送通信量），Reduce-Scatter阶段的通信量为 $(N - 1) \frac{\Phi}{N}$ ，All-Gather阶段的通信量为 $(N - 1) \frac{\Phi}{N}$ 。单卡通信量为 $2(N - 1) \frac{\Phi}{N}$，随着 $N$ 的增大，可以近似为 $2\Phi$ ，全卡总通信量为 $2N\Phi$。

而对于PS架构，Server承载的通信量为 $N\Phi$，Workers的总通信量为 $N\Phi$ ，全卡通信量也为 $2N\Phi$ 。

虽然通信量相同，但Ring All-Reduce架构将通信量均衡负载到了每一时刻的每个Worker上，而PS架构的负载集中于Server。

 

## 3 ZeRO

### 3.1 存储消耗

![image-20250212130752924](/image-20250212130752924.png)

### 3.2 ZeRO-DP

<img src="/image-20250207163953095.png" alt="image-20250207163953095" style="zoom:80%;" />

#### $P_{os}$

将优化器状态（Optimizer States）分成若干份，每块GPU上各维护一份。

每个GPU上的进程完成一轮forward和backward后，各算得一份Local梯度。对梯度做All Reduce，得到聚合后梯度G。

梯度和部分优化器状态更新部分参数，再做All Gather获得完整参数W。

#### $P_{os + g}$

更进一步，将梯度也拆分，每个GPU各维护一份梯度。

每个GPU上的进程完成一轮forward和backward后，各算得一份Local梯度。由于GPU只需要维护自己那部分梯度，所以做Reduce Scatter将部分梯度做聚合。

使用部分梯度和部分优化器状态更新部分参数，再做All Gather获得完整参数W。

#### $P_{os + g + p}$

将参数也切分成若干份，每个GPU上维护一份参数。

每个GPU进程在forward时对W做All Gather来获得完整参数参与计算。在backward时也对W做All Gather，取到完整的参数W。

做完backward，算得梯度G。对G做Reduce Scatter来聚合部分梯度。

使用部分梯度和部分优化器状态更新部分参数，由于只维护部分参数W，无需再进行通讯。



使用ZeRO2（$P_{os + g}$）时的通信量与普通DP的通信量一致，因为All Reduce就是这么实现的（All Reduce = Reduce Scatter + All Gather）。

将参数也切分后，会引入额外的通信，属于用通信来换内存。（通信量由$2\Phi$增加到 $3\Phi$ ，增加到1.5倍）



### 3.3 ZeRO-R

#### Activation

对Activation的拆分主要用于张量并行（Megatron-LM）。在张量并行中，尽管将参数拆分到不同的GPU上，但输入向量（Activation）还是要完整地在每个GPU上复制一份。ZeRO采用与前面类似的方式，将Activation做拆分，每个GPU上维护一份Activation。

在forward时，通过All Gather获得完整的Activation来参与计算。计算完成后，TP节点之间通过All Reduce来聚合输出，同样，由于每个GPU上只需要保存部分Activation，可以使用Reduce Scatter来聚合。

在backward时，做All Gather获得完整的Activation来进行计算。

#### Buffer

设置合适的、固定大小的buffer。

#### Memory Fragmentation

根据张量的生命周期管理和重整内存。







## X 参考

[图解大模型训练之：数据并行上篇(DP, DDP与ZeRO)](https://zhuanlan.zhihu.com/p/617133971)

[Scaling Distributed Machine Learning with the Parameter Server](https://www.usenix.org/system/files/conference/osdi14/osdi14-paper-li_mu.pdf)

[图解大模型训练之：数据并行下篇( DeepSpeed ZeRO，零冗余优化)](https://zhuanlan.zhihu.com/p/618865052)

[ZeRO: Memory Optimizations Toward Training Trillion Parameter Models](https://arxiv.org/abs/1910.02054)


