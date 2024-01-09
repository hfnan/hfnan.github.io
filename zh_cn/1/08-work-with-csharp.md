# 与 C# 交互
> Kula 语言 底层由 C# 写成，自然和 C# 语言拥有极好的契合度。    
> 本篇将详细讲解如何在 C# 中使用 Kula

!> 本篇待重构  
本篇待重构  
本篇待重构  
本篇待重构  
本篇待重构  
本篇待重构  
本篇待重构  
本篇待重构  
本篇待重构  
本篇待重构  

## 在 C# 中 加载 Kula
> 在 C# 中使用 Kula 需要基于 `kula.dll` 中提供的开放类 `KulaEngine`

我们可以通过构造对象的方式来直接加载 Kula 引擎。
```csharp
KulaEngine engine = new KulaEngine();
```

Kula 引擎是一个状态机，其中包含了已经编译完成的代码块。

当我们想要运行代码时，我们需要首先编译目标代码：
```csharp
// 我们需要的参数有：目标代码，代码昵称，是否为Debug编译
engine.CompileCode("println(\"hello_world\");", "first-program", true);
```

这行代码会将目标代码编译，并储存在 `KulaEngine` 对象的 一个 `Dictionary<string, Func>` 中，索引即为代码昵称 `"first-program"`。

此后，如果我们想要运行代码，需要：
```csharp
// 参数有：代码昵称，是否为Debug运行
engine.Run("first-program", true);
```
即可。

> 如果我们想清除掉 KulaEngine 里已经存储的变量，需要使用 `Clear()` 函数。  
> `Clear()` 会清空对应 KulaEngine 环境的 **虚拟机栈 和 变量表**


## KulaEngine 数据域
> KulaEngine 是你在 C# 中唯一开放使用的接口，因此了解其尤为重要   
> KulaEngine 中封装了对 Kula 语言编译器的调用，以及一些基础的数据结构。这些内容确保了 Kula 语言的可用性以及 和C# 的交互性。

### `Engine`
`Engine` 字段是 每个 KulaEngine 内置的数据容器，你可以自行定义扩展方法调用这个容器，他是 C# 和 Kula 交换数据的基础。

在 Kula 语言中，`Engine` 是这个容器的对应关键字，你可以通过他来和 C# 交换数据。

### `ExtendFunc`
`ExtendFunc` 是每个 KulaEngine 对应的扩展函数集。

### 一些不重要的
`Version` 版本号

## 扩展函数
> 扩展函数 是 C# 和 Kula 交互的最直接方式，他允许 Kula 调用 C# 写好的方法。

扩展函数基于底层的委托 `SharpFunc`。

当需要扩展函数时，我们需要实现这个委托，并将其写入 **`KulaEngine`类的静态集合`ExtendFunc`中** ：
```csharp
kulaEngine.ExtendFunc["hello_world"] = (args, engine) => { Console.WriteLine("hello_world"); return null; };
```

之后我们便可以在 Kula 语言脚本中直接调用这个函数
```kula
hello_world();      # hello_world
```

值得注意的是：
+ 该委托接收两个参数：`args`, `engine`。
  + 其中 `args` 对应 Kula 语言传入的所有参数，类型为 `object[]`。
  + `engine` 对应当前引擎。
+ 该委托有一个 `object` 返回值，若不需要返回值，设为 `null` 即可。

## 在 C# 中调用 Kula 的 Func
> `Call` 方法允许你在 C# 中直接的调用传入的 Kula 函数

`Call` 方法是一个在 C# 中已经封装好的，可以直接调用 Kula Func 的方法。

```kula
# 假设 foo 函数已经被传入 DataMap
foo := func():None {
    println("hello_world");
};
```
```csharp
var foo = kulaEngine.DataMap.Data["foo"];
kulaEngine.Call(foo, null);
```

!> Kula 底层源码里为了实现复杂的闭包机制，借助了多个类结构来实现匿名函数 `Func`。其中 `Lambda` 在编译期先被注入代码，紧接着被编译为可执行字节码流，之后由 `Func` 结构将其接收。`Func` 中包含了他被声明的外部环境信息。  
可以作为参数互相传递的是 `Func` 而不是 `Lambda`，但你即使不知道这一点也可以正常的使用。