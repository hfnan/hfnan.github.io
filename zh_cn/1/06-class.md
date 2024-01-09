# 数据结构
Kula 语言中的数据结构，是对计算机科学中常见的数据结构的封装。    

目前支持的结构有：
1. `Array` 定长数组
2. `Map` 字符串索引字典

## `Array` 定长数组
`Array` 是一个连续的，固定长度的一块内存空间。其中可以存放 Kula 语言中的任意类型的数据。    
对数组的操作需要依赖内置函数。    

### 初始化
初始化数组需要用到 内置函数 `new(size: Num): Array`    
这个函数的返回值即为新构造出来的数组。我们用一个变量接受他就可以了。
```kula
arr = Array.new(16);     # 我们申请了一个长度为16的数组
```

数组按长度初始化后，对应位置会被填入常量 `null`

### 填充
对数组元素填充需要用到 内置函数 `fill(arr: Array, pos: Num, val: Any): None`    
```kula
Array.fill(arr, 0, "hello");
Array.fill(arr, 1, 114514);
Array.fill(arr, 2, Array.new(4));
Array.fill(arr, 3, func():None { Shell.println("hello_world"); });
```
以上操作都是合法的，因为 Kula 的数组 **什么都能装！**

> 数组的索引规则：    
> 和其他语言一样，数组索引从零开始。    
> 也就是说，当数组长度为 16 时，数组合法的索引范围是 0-15。    

### 随机访问
> 随机访问 指 *按索引任意访问*

数组的随机访问使用 `[ pos: Num ]` 的格式，在中括号中填写索引即可。
```kula
arr[0];        # hello
arr[1];        # 114514

```

!> 注意：    
索引的随机访问只能用于**读**，而不能用于**写** ！    
填充数组只能使用 内置函数`fill`

### 更多操作
`size(arr: Array): Num` 测量数组长度。


## `Map` 字符串索引字典
`Map` 是一种 **键值对** 结构。可以存放 任意数量的 Kula语言中的值。

对 `Map` 的操作也需要用到 内置函数

### 初始化
和 `Array` 类似，但是 `Map` 不需要指定长度。    
对应函数为 `new(): Map`
```kula
dict = Map.new();
```

### 填充
和数组类似，使用内置函数 `put(key: Str, val: Any): None`
```kula
Map.put(dict, "java", "Bad.");
Map.put(dict, "c#", "Good!");
Map.put(dict, "kula", "AWESOME!!!");
```

**Map 也是什么都能装的！**

### 访问
和数组类似，使用 `[ key: Str ]` 的形式。

```kula
Shell.println(dict["kula"]);
```

### 更多操作
`count(map: Map): Num` 测量当前 Map 的体积    
`keyIn(map: Map, key: Str): Num` 考察当前 key 是否在当前 Map 中

### for 函数
> `for` 是 Kula 语言中内置的高阶函数。

`for(map: Map, op: Func): None` for 函数是对于 `Map` 数据结构的遍历。

其中，`op` 参数必须是一个 符合以下格式的函数：    
`func(k: Str, v: Any): None`

利用 `for` 函数，我们可以遍历 `Map`，这为我们对 Map key 未知情况下的操作提供了方便。

```kula
map := newMap();
Map.put(map, "a", "hello");
Map.put(map, "b", "-");
Map.put(map, "c", "world");
Map.for(map, func(k: Str, v: Any): None {
    Shell.println(Str.concat(k, Str.concat(" : ", Str.toStr(v))));
});
```