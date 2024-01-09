# 高阶类型 (函数类型) (Pre-0.4 版本后加入)
> kula 在 Pre-0.4 版本以后加入了高阶类型，允许通过指定函数原型来约束函数的类型

## 高阶类型类型表达式
高阶类型是一个 **类型表达式**，他可以将类型作为参数，来描述一个更细分的类型。

在 kula 语言中，高阶类型被用于函数类型校验。

范式：
```
Func < [{参数类型}][,] > : {返回值类型}
```
冒号可以换成双线箭头 `=>`

例如，对于函数
```kula
# 经典斐波那契数列
fib := func(x: Num): Num {
    if (lt(x, 2)) {
        return x;
    }
    else {
        return plus(fib(minus(x, 1)), fib(minus(x, 2)));
    }
};
```
即满足高阶类型
```kula
Func<Num>:Num
```

> 注意：  
> 高阶类型表达式只能用作类型，而不能用作其他表达式。

## 使用高阶类型
高阶类型可以用于函数类型校验，
* 防止我们对<span class="color-blue">函数</span>传递了<span class="color-red">另一个函数</span>作为参数后，不知道向<span class="color-red">其</span>中传入什么参数。
* 当我们使用鸭子类型作为接口时，可以更明确的定义接口函数。

### 函数参数类型约束
假设当前我们已经实现了一个对数组的排序算法，但若想实现成功的排序，需要我们自行定义比较器，并通过函数参数传入。  
此时，如果想要限制比较器所比较对象的类型和数目，就需要使用到高阶类型。
```kula
sort := func(data: Array, comparator: Func<Any,Any>) : None {
    ...
}
```

### 接口类型约束
当我们定义了一个面向对象式的接口时，如果不使用鸭子类型，就会使接口退化失去意义。

例如，我们需要一个简单的 Stack 栈。
```kula
type Stack {
    isEmpty : Func<>: Num,
    push    : Func<Any>: None,
    pop     : Func<>: Num,
    peek    : Func<>: Num,
}
```

## 讲个笑话

在加入了 Duck-Typing 特性之后，HanamaruYabuki 敏锐的发现，我们其实很少使用鸭子类型约束对象的属性值，更多的时候，我们会用他们约束函数来实现接口。但是在设计初期，并没有打算实现高阶类型，对函数的约束只有 `Func` 一种形式。于是导致写出的代码经常变成：
```kula
type Xxx {
    a: Func, 
    b: Func, 
    c: Func,
};
```  
这样。全是 `Func`，但几乎没有什么类型级的约束性。鸭子类型便失去了原有的类型校验价值。  
于是，坚持优雅的 HanamaruYabuki 便连夜加班赶制出了高阶类型语法。  
哦对了，连夜赶制的代码肯定全是bug，而且当时他以为自己写完了，其实没有写完。于是在某一个倒霉的 Pre-Release 里就留了这么一个坑。

<style>
.color-green {
    color: #0F0;
}
.color-blue {
    color: #00F;
}
.color-red {
    color: #F00;
}
</style>