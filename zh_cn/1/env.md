# 环境配置
> Kula 语言的环境配置非常简单

## 直接在 Windows 平台使用
> Kula 是基于 .net6 开发的，也就意味着 Kula 和 Windows 平台的相性是最好的。

Kula 允许你有两种方式部署：

### Release 直接部署
1. 在当前 Git 仓库中寻找最新的 Release
2. 下载他
3. 把他解压到一个合适的位置，例如 `C:\Program Files\kula`
4. 在系统环境变量中 找到 `Path` 项，将 `kula.exe` 的所在路径写在 `Path` 中
5. 打开控制台，输入 `kula` 测试一下吧 ~

### 自己编译！
1. 克隆当前 Git 仓库到本地
2. 用 `Visual Studio` 等 C# 语言集成开发环境 打开 `.sln` 项目管理文件
3. 以 Release 模式 编译当前项目
4. 在编译路径下，找到 `kula.exe`
5. 重复上一种方法的 3~5 步骤

!> 注意，Kula项目在Github上有多个分支，请尽量使用 `main` 分支下的版本，因为这些总是可用的。

## 在 Mac/Linux 平台使用 ？
并不建议您在非 Windows 环境下折腾 .NET，如果您执意要折腾的话，下面给出笼统的操作步骤

1. 安装 `.NET` 运行时环境，例如 `.NET5 / .NET Core`
2. 克隆当前 Git 仓库的 main 分支
3. 开启新项目，设置目标平台为已安装的运行时环境
4. 将原有的代码复制到刚刚创建的新项目内
5. ~~(手动修复Bug后)~~ 编译
6. 找到编译目标文件后，配置操作系统下对应的环境

!> *本方案未经足够量的实验验证，目前仅在AMD架构下Ubuntu20.04下验证可行*

## 内嵌入 C# 使用

### DLL 引入

强烈建议您，在 github 项目上直接使用最新的 Release 版本(而不是自己编译)

1. 在当前 Git 仓库中寻找最新的 Release
2. 下载他
3. 在他的压缩包儿里找到 `kula.dll`，导入到你的 C# 项目内
4. 实例化一个 `KulaEngine` 类的对象，使用函数 `Run(string code)` 把 Kula 程序跑起来吧！

## VSCode 高亮插件！
HanaYabuki 还专门为 Kula 语言制作了 VSCode 高亮插件！

只需要在 VSCode 里搜索 `Kula - Diana` 就可以咯！