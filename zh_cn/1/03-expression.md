# 表达式
> kula 的表达式是语言运行的基础。

!>本教程会采用一种名为 **“扩展巴科斯范式”** 的表示法进行讲解。本文章不会对此表示法进行讲解，但会给出充足的样例让读者能够尽可能轻松的理解语言的语法。

## 字面量表达式
写什么就是什么，一个常量。
```kula
66      # 一个Number字面量
false   # 一个Bool字面量
"hello" # 一个String字面量
```
字面量只可以是一个基本类型的常量。

## 赋值表达式
赋值主要分为两种：**声明赋值** 和 **更改赋值**
```EBNF
assignment  =   IDENTIFIER ("="|":=") expression ;
```
!> 这里为了临时讲解，表示并不完整

### 声明赋值
```kula
a := 1
```
该表达式会在当前作用域下创建一个名为 `a` 的变量，并将其赋值为 `1`。最终，该表达式的计算结果也为 `1`。

### 改变赋值
```kula
a = 2
```
该表达式会寻找最近作用域下名为 `a` 的变量，并将其赋值为 `2`。最终，该表达式的计算结果也为 `2`。

## 数学表达式
```EBNF
equality    =   comparison (("!=" | "==") comparison)* ;
comparison  =   term ((">" | ">=" | "<" | "<=") term)* ;
term        =   factor (( "-" | "+" ) factor)* ;
factor      =   unary (( "*" | "/" ) unary)* ;
unary       =   ("!" | "-") unary | call ;
...
primary     =   ...
            |   "(" expression ")"
            ;
```

数学运算，算就完事儿了！
```kula
1 + 2               # 看起来很简单的运算
"hello" + "world"   # 字符串也能算
1 > 2               # 比较运算，会产生一个Bool值
-1                  # 嗯，这是取负运算
(1+2)/3-4           # 语法包含了优先级和小括号
```

### 运算赋值语法糖
```EBNF
assign  =   ("=" | ":=" | "+=" | "-=" | "*=" | "/=" | "%=") ;
```
所以，我们对于频繁迭代运算的变量有更简单的写法：
```kula
a = a + 6   # 复杂写法
a += 6      # 等价的简单写法
```

## 逻辑表达式
```EBNF
logicOr     =   logicAnd ("or" logicAnd)* ;
logicAnd    =   equality ("and" equality)* ;
...
unary       =   ("!" | "-") unary | call ;
```
用于计算两个 `Bool` 类型的值，其中 `and` 比 `or` 更优先结合。

### 短路
当 `and` 的左值为 `false`，以及 `or` 的左值为 `true` 时，不计算右值。
```kula
if (ptr != null and ptr.key == value) {
    print "这是标准的判空写法，所以空了当然不会报错";
}
```

## 调用表达式
```EBNF
call        =   primary ("(" arguments ? ")" | "." IDENTIFIER | "[" expression "]")* ;
arguments   =   expression ("," expression)* ;
```
调用表达式可以恰当的使用复杂的数据结构和函数。
```kula
fib(10)     # 调用fib函数，参数为10
obj.key     # 取名为obj的Object中名为key的键对应的值
obj["key"]  # 和上条等价
arr[1]      # 取名为arr的Array中1号位的值
```
使用调用表达式调用函数，可以执行函数行为，并返回其计算结果。\
使用调用表达式调用数据容器，可以将其中的值取出。

## 函数表达式
```EBNF
function        =   "func" (lambda | arrowFunction) ;
arrowFunction   =   "(" parameters? ")" "=>" expression ;
lambda          =   "(" parameters? ")" block ;
...
parameters      =   IDENTIFIER ("," IDENTIFIER)* ;
```
函数表达式比较复杂，他的作用是创造一个函数常量。
```kula
# 这是一个id函数
func (x) {
    return x;
}
# 这是一个箭头函数形式的id函数
(x) => x
```

标准函数表达式需要使用 `block` 块语句作为函数体，具体细节会在后文讲解。\
而箭头函数形式是一种特殊情况下的简单语法，当函数仅有一个返回值语句时可以用它来简化。

## 附录 - 总语法 - 表达式部分
```EBNF
expression      =   assignment
                ;

assignment      =   (call ".")? IDENTIFIER assign expression
                |   logicOr 
                ;

assign          =   ("=" | ":=" | "+=" | "-=" | "*=" | "/=" | "%=")
                ;

logicOr         =   logicAnd ("or" logicAnd)* 
                ;

logicAnd        =   equality ("and" equality)* 
                ;

equality        =   comparison (("!=" | "==") comparison)* 
                ;

comparison      =   term ((">" | ">=" | "<" | "<=") term)* 
                ;

term            =   factor (( "-" | "+" ) factor)* 
                ;

factor          =   unary (( "*" | "/" | "%" ) unary)* 
                ;

unary           =   ("!" | "-") unary | call 
                ;

call            =   primary ("(" arguments ? ")" | "." IDENTIFIER)* 
                ;

primary         =   "true" | "false" | "null" | "this" 
                |   NUMBER | STRING | IDENTIFIER 
                |   "(" expression ")" 
                |   function
                |   arrowFunction
                ;

function        =   "func" (lambda | arrowFunction) 
                ;

arrowFunction   =   "(" parameters? ")" "=>" expression
                ;

lambda          =   "(" parameters? ")" block
                ;

parameters      ::= IDENTIFIER ("," IDENTIFIER)* 
                ;

arguments       ::= expression ("," expression)* 
                ;
```