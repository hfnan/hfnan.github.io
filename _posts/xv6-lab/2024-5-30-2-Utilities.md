# Lab: Xv6 and Unix utilities

## Boot xv6 (easy)

获取 xv6 实验源代码，切换到 util 分支：

```
git clone git://g.csail.mit.edu/xv6-labs-2020 .
git checkout util
```

启动 xv6：

```
make qemu
```



在 xv6 中，

使用 `Ctrl-p` 使内核打印每个进程的信息

使用 `Ctrl-a x` 退出 qemu 模式



用评分程序测试解法：

```
make grade
```

或对某个任务单独测试：

```
./grade-lab-util <assignment>
```



## sleep (easy)

> 在 xv6 中实现 Unix 程序 sleep。你的sleep应该停用户指定的 tick 数。一个 tick 是 xv6 内核定义的时间单位，即计时器芯片两个中断之间的间隔。实现写在文件 `user/sleep.c` 中。

从 `main` 函数的参数 `argv` 中获取命令行参数，使用 `atoi` 将字符串形式的参数转换为整数，使用系统调用 `sleep` 暂停 n ticks，使用系统调用 `exit` 结束进程。

```c
// Sleep
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"

int 
main(int argc, char *argv[])
{
    if (argc != 2) {
        fprintf(2, "Usage: sleep ticks\n");
        exit(1);
    }

    printf("(nothing happens for a little while)\n");
    sleep(atoi(argv[1]));
        
    exit(0);
}
```



## pingpong (easy)

> 写一个程序，利用Unix系统调用，通过一对管道去在两个进程之间”乒乓“一个字节。每个管道管一个方向。父进程向子进程发送一个字节，子进程打印`<pid>: received ping`，其中`<pid>`是进程ID，然后将这个字节写进管道传给父进程，然后退出。父进程从子进程那里读取字节，打印`<pid>: received pong`，然后退出。你的解法应写在文件`user/pingpong.c`中。

定义两个方向的管道`p_p2c[2]`和`p_c2p[2]`，分别用于父进程向子进程传输与子进程向父进程传输。使用`pipe`将文件描述符保存在数组中。使用`fork`创建进程，其中返回值为0的进程是子进程。使用`read`和`write`对管道进行读写，对于一个管道，一般从0端读取，向1端写入。注意在读写之前关闭相对的另一端。

```c
// Pingpong
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"


// Idea: Use 2 pipe, one for transmission from parent to child, 
// another for transmission from child to parent.
int
main(int argc, char *argv[]) 
{
    int p_p2c[2], p_c2p[2];

    if (argc != 1) {
        fprintf(2, "Usage: pingpong\n");
        exit(1);
    }

    pipe(p_p2c);
    pipe(p_c2p);
    if (fork() == 0) {
        char byte;

        close(p_p2c[1]);
        read(p_p2c[0], &byte, 1);
        close(p_p2c[0]);

        printf("%d: received ping\n", getpid());
        
        close(p_c2p[0]);
        write(p_c2p[1], &byte, 1);
        close(p_c2p[1]);
    }
    else {
        char byte;

        close(p_p2c[0]);
        write(p_p2c[1], "X", 1);
        close(p_p2c[1]);

        close(p_c2p[1]);
        read(p_c2p[0], &byte, 1);
        close(p_c2p[0]);

        printf("%d: received pong\n", getpid());
    }
    exit(0);
}
```



## primes (moderate)/(hard)

> 用管道写一个并发版本的素数筛。你的解法写在文件`user/primes.c`中。

第一个进程将2到35写入管道，接下来后续的每个进程都遵循同样的模式：从前一个管道中读取数字，将第一个数字打印出来，并据此筛掉其倍数的数字。将剩余数字写入后一个管道。利用递归来实现。注意当管道的写端关闭时，`read`返回0。

```c
// Primes
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"


void 
one_prime(int *p_in) 
{
    int x, p[2];

    close(p_in[1]);
    
    if (read(p_in[0], &x, sizeof(int)) == 0) 
        return;    
    printf("prime %d\n", x);

    pipe(p);
    if (fork() == 0) {
        close(p_in[0]);
        one_prime(p);
    }   
    else {
        int px;
        close(p[0]);
        while (read(p_in[0], &px, sizeof(int)) != 0) {
            if (px % x != 0)
                write(p[1], &px, sizeof(int));
        }
        close(p[1]);
        close(p_in[0]);
        wait((int*)0);
    }     
}

// Recursion
int 
main(int argc, char *argv[])
{
    int p[2];

    pipe(p);
    if (fork() == 0) {
        one_prime(p);
    }   
    else {
        close(p[0]);
        for (int i = 2; i <= 35; i ++) {
            write(p[1], &i, sizeof(int));
        } 
        close(p[1]);
        wait((int*)0);
    } 
    exit(0);
}
```



## find (moderate)

> 写一个Unix的find程序的简单版本：找到一个目录下具有指定名字的所有文件。你的解法应该写在文件`user/find.c`中。

`find`接受一个目录`path`与一个文件名`name`。首先使用`open`获得该目录的文件描述符fd，然后使用`fstat`获得该目录文件的stat。如果它不是一个目录，则报错；如果它是目录，则使用`read`依次读取其中的目录项，并组合路径。如果目录项的文件名与所求的文件名匹配，则输出该文件路径。如果一个目录项是目录，则递归地在该目录中继续查找。

```c
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"
#include "kernel/fs.h"

void
find(char *path, char *name) 
{
    char buf[512], *p;
    int fd;
    struct stat st;
    struct dirent de; // Directory Entry.

    if ((fd = open(path, 0)) < 0) {
        fprintf(2, "find: cannot open %s\n", path);
        return;
    }

    if (fstat(fd, &st) <0) {
        fprintf(2, "find: cannot stat %s\n", path);
        close(fd);
        return;
    } 

    switch (st.type) {
    case T_FILE:
        fprintf(2, "find: %s should be a directory\n", path);
        return;

    case T_DIR:
        if (strlen(path) + 1 + DIRSIZ + 1 > sizeof(buf)) {
            printf("find: path too long\n");
            break;
        }

        strcpy(buf, path);
        p = buf + strlen(path);
        *p++ = '/';
        while (read(fd, &de, sizeof(de)) == sizeof(de)) {
            if (de.inum == 0) 
                continue;
            if (strcmp(de.name, ".") == 0 || strcmp(de.name, "..") == 0) 
                continue;
            // memmove will behave well when dst and src overlap.
            memmove(p, de.name, DIRSIZ);
            p[DIRSIZ] = 0;

            if (strcmp(de.name, name) == 0) 
                printf("%s\n", buf);
            
            if (stat(buf, &st) < 0) {
                printf("ls: cannot stat %s\n", buf);
                continue;
            }

            if (st.type == T_DIR) 
                find(buf, name);
        }
        break;
    }
    close(fd);
}

int
main(int argc, char *argv[]) 
{
    if (argc != 3) 
        fprintf(2,"Usage: find path name\n");
    
    find(argv[1], argv[2]);

    exit(0);
}
```



## xargs (moderate)

> 写一个简单版本的Unix的xargs程序：从标准输入中读行，对每行执行一个命令，将行作为命令的参数。你的解法应写在文件`user/xargs.c`中。

`xargs`每从标准输入中读取一行，就创建一个进程，执行参数中的命令，并将读取的行添加为该命令的最后一个参数。使用`exec`执行命令，需要为该命令构建参数列表`exec_argv`。

```c
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"
#include "kernel/param.h"

#define ARGSIZ 512

int 
readline(char *buf) 
{
    char *p = buf;
    while (read(0, p, sizeof(char))) {
        
        if (*p == '\n') {
            *p = 0;
            return 1;
        }
        if (p >= buf + ARGSIZ - 1) {
            printf("xargs: too long arg\n");
            return 0;
        } 
        p ++;
    }
    return 0;
}

int
main(int argc, char *argv[]) 
{
    int i = 0, j = 1;
    char buf[ARGSIZ];
    char *exec_argv[MAXARG];
    
    if (argc < 2) {
        fprintf(2, "Uasge: xargs command\n");
        exit(1);
    }
    
    while (j < argc) {
        if (i >= MAXARG) {
            fprintf(2, "xargs: too many args\n");
            exit(1);
        }
        exec_argv[i++] = argv[j++];
    }

    while (readline(buf)) {
        if (fork() == 0) {
            exec_argv[i] = buf;
            exec(exec_argv[0], exec_argv); 
            fprintf(2, "xargs: cannot exec %s\n", exec_argv[0]);
            exit(1);
        }
        else {
            wait(0);
        }
    }    
    exit(0);
}
```



## time.txt

最后，创建一个文件`time.txt`，将自己完成该实验所花的小时数写进文件。



## Result

执行`make grade`，可以看到每个任务是否通过，以及最终得分。

```
== Test sleep, no arguments == 
$ make qemu-gdb
sleep, no arguments: OK (6.0s) 
== Test sleep, returns == 
$ make qemu-gdb
sleep, returns: OK (1.5s) 
== Test sleep, makes syscall == 
$ make qemu-gdb
sleep, makes syscall: OK (1.4s) 
== Test pingpong == 
$ make qemu-gdb
pingpong: OK (1.5s) 
== Test primes == 
$ make qemu-gdb
primes: OK (1.6s) 
== Test find, in current directory == 
$ make qemu-gdb
find, in current directory: OK (1.5s) 
== Test find, recursive == 
$ make qemu-gdb
find, recursive: OK (1.4s) 
== Test xargs == 
$ make qemu-gdb
xargs: OK (1.9s) 
== Test time == 
time: OK 
Score: 100/100
```



## 总结

通过实现这5个用户程序，初步了解了Unix系统调用的简单用法，认识了进程的概念，了解了文件系统的大致组成。

