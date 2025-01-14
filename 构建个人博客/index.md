# 使用Hugo构建个人博客


本文简要记录使用Github Pages与Hugo构建个人博客的流程。

## 1 创建Github Pages Repo

这个步骤比较简单，只需要创建一个名为`yourname.github.io`的repo即可。（`yourname`为你的github账户名）

## 2 安装和使用Hugo

1.   安装Hugo：[Installation | Hugo](https://gohugo.io/installation/) （建议下载extended版本）

2.   将`hugo.exe`所在目录添加到环境变量

3.   新建Hugo网站

     ```bash
     hugo new site my_site
     ```

4.   下载主题：（此处以LoveIt为例）

     ```bash
     git clone https://github.com/dillonzq/LoveIt.git my_site/themes/LoveIt
     ```

5.   配置`config.toml` （可以将`my_site/themes/LoveIt/exampleSite/config.toml`复制到`my_site/`目录，并自行修改）

6.   新建文章

     ```bash
     cd my_site
     hugo new posts/first_post.md
     ```

7.   在本地启动网站

     ```bash
     hugo serve
     ```

     去查看 `http://localhost:1313`

## 3 部署到Github Pages

1.   构建网站

     ```bash
     hugo
     ```

     会生成一个 `public` 目录, 其中包含你网站的所有静态内容和资源。

2.   将`public`初始化为git库，并提交至github



## X 参考

[Stilig's blog](https://stilig.me/)

[Yulin Lewis' blog](https://lewky.cn/)
