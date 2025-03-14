# 张量并行


## 1 Megatron-LM

张量并行是由Nvidia团队在Megatron-LM一文中提出的，针对Transformer模型训练的模型并行（文中称之为Model Parallelism）。事实上张量并行也属于模型并行，与GPipe提出的按照模型的层横向切分不同，张量并行将模型的参数纵向切分，分别放到不同的GPU上并行计算，然后再做聚合。

Megatron-LM提出的模型并行（张量并行）提供了将Transformer的各个层垂直切分的方法。



### 1.1 MLP

![image-20250212151007439](/image-20250212151007439.png)

<img src="/image-20250212151022850.png" alt="image-20250212151022850" style="zoom:60%;" />



![image-20250212151745415](/image-20250212151745415.png)



### 1.2 Self Attention

![image-20250212151812213](/image-20250212151812213.png)



### 1.3 Embedding

Word Embedding是一个 $v \times h$ 的字典，其中 $v$ 可能很大，因此按 $v$ 进行拆分，放在不同的GPU中。

输入Embedding是一个查字典的过程，输入X分别到多个GPU上去查每个GPU上维护的那部分Embedding，然后通过All Reduce聚合。

输出Embedding是一个Linear层，按照MLP中的方法进行计算和聚合。





## X 参考

[图解大模型训练之：张量模型并行(TP)，Megatron-LM](https://zhuanlan.zhihu.com/p/622212228)

[Megatron-LM: Training Multi-Billion Parameter Language Models Using Model Parallelism](https://arxiv.org/abs/1909.08053)

