# 字符串函数 （命名空间`Str`）

字符串函数一般用于操作字符串，或将其他数据转化成必要的可读的字符串形式。

| 函数名称 | 范式                                               | 作用描述                                                        |
| -------- | -------------------------------------------------- | --------------------------------------------------------------- |
| toStr    | `toStr(obj: Any): Str`                             | 将 `obj` 转化为 对应的字符串                                    |
| parseNum | `parseNum(x: Str): Any`                            | 将 数字字面量字符串`x` 解析为对应 `Num`，解析失败时返回原字符串 |
| len      | `len(str: Str): Num`                               | 求字符串 `str` 的长度                                           |
| cut      | `cut(str: Str, startIndex: Num, length: Num): Str` | 从 `startIndex` 处切字符串 `str` 至长度为 `length`              |
| concat   | `concat(str1: Str, str2: Str): Str`                | 将 `str1` 和 `str2` 拼接成一个新字符串                          |
| type     | `type(obj: Any): Str`                              | 求数据 `obj` 的类型，返回对应字符串                             |
