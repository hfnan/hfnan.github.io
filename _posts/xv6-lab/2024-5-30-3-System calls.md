# Lab: system calls

切换到syscall分支：

```
git fetch
git checkout syscall
make clean
```



## System call tracing (moderate)

> 在这个任务中，你将添加一个系统调用跟踪功能，它将在你调试之后的实验时提供帮助。你将创建一个新的`trace`系统调用来控制跟踪。它接受一个参数——一个整数掩码，这个掩码的位数指定了要跟踪哪个系统调用。例如，要跟踪`fork`系统调用，程序会调用`trace(1 << SYS_FORK)`，其中`SYS_FORK`是`kernel/syscall.h`中的系统调用号。你需要修改xv6内核，如果系统调用号在掩码中设置，则在该系统调用将要返回时打印一行。这行包括进程ID、系统调用名以及返回值。你不需要打印系统调用参数。`trace`系统调用要跟踪调用它的进程以及该进程随后创建的子进程，但不应该影响其他进程。

要想能够使用这个系统调用，先把它的名字加到`user/user.h`，`user/usys.pl`中，然后在`kernel/syscall.h`中为它分配一个系统调用号。

在`user/usys.pl`中添加：

```
entry("trace");
```

虽然我不懂perl，但我觉得他大概生成了一个汇编代码文件，其中是用到了这个系统调用的系统调用号，具体来讲，大概是将系统调用号存到a7里，然后通过ecall来执行系统调用，最后返回。

```perl
sub entry {
    my $name = shift;
    print ".global $name\n";
    print "${name}:\n";
    print " li a7, SYS_${name}\n";
    print " ecall\n";
    print " ret\n";
}
```

在`user/user.h`中添加：

```c
int trace(int);
```

提供了一个函数声明，免得用户程序找不到trace的声明。

在`kernel/syscall.h`中添加：

```c
#define SYS_trace  22
```

为trace分配了一个系统调用号。

在完成了上述三部分的添加之后，虽然还没有trace的具体实现，但已经能通过make qemu的编译了。

在xv6中执行 `trace 32 grep hello README`，产生如下错误：

```
$ trace 32 grep hello README
6 trace: unknown sys call 22
trace: trace failed
```

搜索报错信息，得知是在`kernel/syscall.c`中产生的错误：

```
$ grep -r "unknown sys call" .
Binary file ./kernel/kernel matches
./kernel/syscall.c:    printf("%d %s: unknown sys call %d\n",
```

查看`kernel/syscall.c`文件，发现如下函数：

```c
void
syscall(void)
{
  int num;
  struct proc *p = myproc();

  num = p->trapframe->a7;
  if(num > 0 && num < NELEM(syscalls) && syscalls[num]) {
    p->trapframe->a0 = syscalls[num]();
  } else {
    printf("%d %s: unknown sys call %d\n",
            p->pid, p->name, num);
    p->trapframe->a0 = -1;
  }
}
```

可以发现，syscall函数中，从a7寄存器里获得了系统调用号，通过一个if来验证这个号码的有效性，然后执行对应序号的函数，并把返回值保存在a0里。

视线稍微向上看，发现`syscalls`是一个保存了函数指针的数组，其中每个系统调用号对应一个函数。稍微检查一下，发现各个函数基本都定义在`kernel/sysproc.c`与`kernel/sysfile.c`这两个文件里。仿照syscalls中的模式，在`kernel/syscall.c`中添加：

```c
extern uint64 sys_trace(void); // 添加一行

static uint64 (*syscalls[])(void) = {
...
[SYS_trace]   sys_trace,	   // 添加一行
}
```

在`kernel/sysproc.c`中，仿照其他系统调用函数，添加sys_trace的定义：

````c
uint64
sys_trace(void) 
{
  
}
````

但这个函数没有参数，那么我们trace系统调用的参数从哪里来呢？查看其他函数，发现它们调用了`argint`或`argaddr`函数来获取参数。这两个函数定义在`kernel/syscall.c`中，而且两个函数几乎一样，都调用了`argraw`函数。

```c
static uint64
argraw(int n)
{
  struct proc *p = myproc();
  switch (n) {
  case 0:
    return p->trapframe->a0;
  case 1:
    return p->trapframe->a1;
  case 2:
    return p->trapframe->a2;
  case 3:
    return p->trapframe->a3;
  case 4:
    return p->trapframe->a4;
  case 5:
    return p->trapframe->a5;
  }
  panic("argraw");
  return -1;
}
```

argraw根据参数n返回寄存器a0到a5中的一个。trace只有一个参数，所以只需要取n=0。

在`kernel/sysproc.c`的sys_trace函数中添加：

```c
uint64
sys_trace(void) 
{
  int mask;						// 添加一行
  
  if (argint(0, &mask) < 0) 	// 添加一行
  	return -1;					// 添加一行
}
```

为了实现trace的功能，需要在执行trace的当前进程，以及其创建的子进程中，每当trace跟踪的系统调用即将返回时，打印出该系统调用的进程ID、系统调用名及返回值。

为了让进程知道trace跟踪了哪些系统调用，我们将mask的值保存在进程的状态里。

为`kernel/proc.h`中的struct proc添加一个新字段`mask`：

```c
// Per-process state
struct proc {
  struct spinlock lock;

  // p->lock must be held when using these:
  enum procstate state;        // Process state
  struct proc *parent;         // Parent process
  void *chan;                  // If non-zero, sleeping on chan
  int killed;                  // If non-zero, have been killed
  int xstate;                  // Exit status to be returned to parent's wait
  int pid;                     // Process ID
  int mask;                    // Trace syscall mask  // 添加一行

  // these are private to the process, so p->lock need not be held.
  uint64 kstack;               // Virtual address of kernel stack
  uint64 sz;                   // Size of process memory (bytes)
  pagetable_t pagetable;       // User page table
  struct trapframe *trapframe; // data page for trampoline.S
  struct context context;      // swtch() here to run process
  struct file *ofile[NOFILE];  // Open files
  struct inode *cwd;           // Current directory
  char name[16];               // Process name (debugging)
};
```

我不确定mask是否是进程私有的，所以暂时把它放在这个位置。

由于未初始化时，mask字段默认为0，不会跟踪任何系统调用，因此暂时不需要担心初始化的问题。

接着在`kernel/proc.c`中定义trace函数，实现trace的功能：

```c
int 
trace(int mask) 
{
  struct proc *p = myproc();
  p->mask = mask;
  return 0;
}
```

trace函数只需要将当前进程的mask设置为传入的mask参数，其后，mask值将通过fork传递给子进程，并通过syscall函数在系统调用返回时匹配并打印相关内容。

在`kernel/sysproc.c`的sys_trace函数中添加对trace函数的调用：

```c
uint64
sys_trace(void) 
{
  int mask;						
  
  if (argint(0, &mask) < 0) 	
  	return -1;					
  return trace(mask);			// 添加一行
}
```

别忘了在`kernel/defs.h`头文件里加上函数声明。（虽然我也不知道为什么要放在这个头文件里，不过其他函数的声明都在这里，所以让trace也在这里吧）

接下来在`kernel/proc.c`的fork函数中添加一行，将父进程的mask值复制给子进程：

```c
int
fork(int) 
{
  ...
  np->sz = p->sz;
  np->mask = p->mask;			// 添加一行
  ...
}
```

最后在`kernel/syscall.c`的syscall函数中添加打印的语句：

```c
void
syscall(void)
{
  int num;
  struct proc *p = myproc();

  num = p->trapframe->a7;
  if(num > 0 && num < NELEM(syscalls) && syscalls[num]) {
    p->trapframe->a0 = syscalls[num]();
    if (((p->mask >> num) & 1) == 1) 						// 添加一行
      printf("%d: syscall %s -> %d\n", 						// 添加一行
              p->pid, syscallsname[num], p->trapframe->a0); // 添加一行
  } else {
    printf("%d %s: unknown sys call %d\n",
            p->pid, p->name, num);
    p->trapframe->a0 = -1;
  }
}
```

为了打印系统调用名，需要创建一个数组，在syscalls数组下面添加：

```c
static char *syscallsname[] = {
[SYS_fork]    "fork",
[SYS_exit]    "exit",
[SYS_wait]    "wait",
[SYS_pipe]    "pipe",
[SYS_read]    "read",
[SYS_kill]    "kill",
[SYS_exec]    "exec",
[SYS_fstat]   "fstat",
[SYS_chdir]   "chdir",
[SYS_dup]     "dup",
[SYS_getpid]  "getpid",
[SYS_sbrk]    "sbrk",
[SYS_sleep]   "sleep",
[SYS_uptime]  "uptime",
[SYS_open]    "open",
[SYS_write]   "write",
[SYS_mknod]   "mknod",
[SYS_unlink]  "unlink",
[SYS_link]    "link",
[SYS_mkdir]   "mkdir",
[SYS_close]   "close",
[SYS_trace]   "trace",
};
```

至此，trace系统调用的实现就已经完成了。

执行`./grade-lab-syscall trace`，会发现测试全部通过。



## Sysinfo (moderate)

> 在这个任务中，你要添加一个系统调用sysinfo，它收集正在运行的系统的信息。这个系统调用接受一个参数——指向struct sysinfo的指针（ 见`kernel/sysinfo.h`）。内核应该填充这个结构体的字段：`freemem`字段是空闲内存的字节数，`nproc`字段是`state`不为`UNUSED`的进程数。

与trace的实现一样，先在`user/user.h`，`user/usys.pl`和`kernel/syscall.h`中添加sysinfo的声明和系统调用号。注意，sysinfo的函数声明需要用到struct sysinfo，仿照struct stat和struct rtcdate，在`user/user.h`文件开头添加struct sysinfo的声明。

并把用户测试程序sysinfotest添加到Makefile。

在`kernel/syscall.c`中将sys_sysinfo函数添加到syscalls数组中。

我不确定sys_sysinfo应该写在`sysproc.c`里还是`sysfile.c`里，不过我决定跟sys_trace一样，写在`sysproc.c`里。

sysinfo的参数是一个指针，换句话说就是一个地址，所以使用`argaddr`来获取参数。

```c
uint64
sys_sysinfo(void) 
{
  uint64 p;

  if (argaddr(0, &p) < 0) 
    return -1;
  
  return sysinfo(p);
}
```

具体实现在sysinfo函数中，我将它定义在`kernel/proc.c`中：

```c
int
sysinfo(uint64 addr) 
{
  
}
```

我们分别调用两个函数来获取freemem和nproc的值，并用这两个值来构造struct sysinfo：

```c
int
sysinfo(uint64 addr) 
{
  struct proc *p = myproc();		// 添加一行
  struct sysinfo si;				// 添加一行

  si.freemem = freemem();	 		// 添加一行
  si.nproc = nproc(); 				// 添加一行

  return 0;							// 添加一行
}
```

查看`kernel/file.c`中的`filestat`函数，发现其中使用了`copyout`函数将数据从内核复制到了用户空间。在sysinfo中添加copyout：

```c
int
sysinfo(uint64 addr) {
  struct proc *p = myproc();
  struct sysinfo si;

  si.freemem = freemem();
  si.nproc = nproc();

  if (copyout(p->pagetable, addr, (char *)&si, sizeof(si)) < 0)	// 添加一行
    return -1;													// 添加一行

  return 0;
}
```

在`kernel/kalloc.c`中添加`freemem`函数的定义：

```c
uint64
freemem(void) 
{
  uint64 mem = 0;
  for (struct run *p = kmem.freelist; p; p = p->next) {
    mem += PGSIZE;
  }
  return mem;
}
```

`kmem`管理着物理内存中空闲的页。freemem通过遍历空闲列表，计算出空闲的内存有多少字节。

在`kernel/proc.c`中添加`nproc`函数的定义：

```c
uint64
nproc(void) 
{
  struct proc *p;
  uint64 n = 0;
  
  for (p = proc; p < &proc[NPROC]; p ++) {
    if (p->state != UNUSED)
      n ++;
  }
  return n;
}
```

`proc`数组包含了系统中的进程，nproc遍历proc数组，并统计其中状态不为UNUSED的进程数。

最后在`kernel/defs.h`中添加这三个函数的声明。

至此，sysinfo系统调用就实现完成了。

执行`make qemu`，并在xv6中执行`sysinfotest`，会得到`sysinfotest: OK`的反馈。



创建`time.txt`，将自己的用时写在里面。



## Result

执行`make grade`：

```
== Test trace 32 grep == 
$ make qemu-gdb
trace 32 grep: OK (5.8s) 
== Test trace all grep == 
$ make qemu-gdb
trace all grep: OK (1.3s) 
== Test trace nothing == 
$ make qemu-gdb
trace nothing: OK (1.4s) 
== Test trace children == 
$ make qemu-gdb
trace children: OK (17.0s) 
== Test sysinfotest == 
$ make qemu-gdb
sysinfotest: OK (2.9s) 
== Test time == 
time: OK 
Score: 35/35
```



## 总结

这两个系统调用的实现大致上解释了xv6是如何实现系统调用的：RISC-V将系统调用号保存在a7中，参数保存在a0~a5中，执行ecall指令来产生系统调用。内核通过一个函数syscall进行路由，调用序号对应的函数，完成相应的功能，并将返回值保存在a0中。

