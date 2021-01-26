上一节中，我们遗留下来一个主要的问题就是renderRule不够灵活
接下来我们思考一下如何解决它

其实，导致它不够灵活的一个关键原因，就在于在new ViewComponent调用的时候数据结构就已经确定，进而DOM的结构也已经确定，当数据发生改变时没法再次更新数据结构，也就没法更新DOM结构

因此，我们很自然会想到，是不是可以将renderRule改成函数的形式，就像下面这样：
new ViewComponent({
  renderRule: function () {
    return {
      tag: 'div',
      class: 'good-detail',
      children: [
        { tag: 'div', class: 'item', content: '名称：{{good.name}}' },
        { tag: 'div', class: 'item', content: 'CPU：{{good.cpuNum}}' },
        { tag: 'div', class: 'item', content: '内存：{{good.memory}}' },
        { tag: 'div', class: 'item', content: '品牌：{{good.brand}}' },
        { tag: 'div', class: 'item', content: '分类：{{good.category}}' },
        { tag: 'div', class: 'item', content: '颜色：{{good.color}}' }
      ]
    }
  }
})

这样一来，每次更新数据时，这个function会重新执行，执行的时候去拿数据改变过了的good，再去取上面的值，自然就可以取到新值了

不过，上次我们还说了一个问题，就是json的格式实在是太不直观了，所以我们接下来再对这个renderRule做一些改动
当然，大家看了我的改动之后一定会很失望，因为改了之后的结果，似乎依然不直观，不过这种不直观的方式，我们需要用一段时间，直到其他重要的模块实现完毕时再来改造这里，我想这样一来，大家会更清楚为什么Vue中要有template，React中要有Jsx，还要费很大劲把它们编译为render函数：

new ViewComponent({
  render: function () {
    return this.createElement('div', { class: 'good-detail' }, [
      this.createElement('div', { class: 'item' }, '名称：{{good.name}}' ),
      this.createElement('div', { class: 'item' }, 'CPU：{{good.cpuNum}}' ),
      this.createElement('div', { class: 'item' }, '内存：{{good.memory}}' ),
      this.createElement('div', { class: 'item' }, '品牌：{{good.brand}}' ),
      this.createElement('div', { class: 'item' }, '分类：{{good.category}}' ),
      this.createElement('div', { class: 'item' }, '颜色：{{good.color}}' )
    ]
  }
})

可以看到，我们不断地调用一个名为createElement的方法，它的入参分别是
param1：要创建的DOM对象的标签名
param2：DOM对象的一些属性
param3：DOM对象的子元素
这个方法我们一会儿就会实现，大家现在要知道它是干啥的，一会儿看的时候更有目的性

还有一点，可以发现我把renderRule改成了render，这是因为renderRule意思是渲染规则，它是一个名词，而render意思是渲染，它是一个动词
我们这里做的工作其实是通过createElement的入参（主要是第3个参数）体现render的渲染规则，同时又把DOM元素创建了出来，所以这其实是一个动作，这一点和上一个版本不同，希望大家引起注意

在此基础之上，我们还要引入根据变量的不同来创建不同的DOM这个效果，为此我准备了一个例子，简单描述下：
点击展开收缩，分别可以查看商品的概要和详细信息

从需求中来看，很容易发现我们需要引入事件

还有一点很重要，我们要通过一个变量的值来跟踪展开收缩的状态，这个值将会作为我们是否渲染详细信息的依据，由于这个值和这个商品详情强关联，所以我们也把它放在data中，我个人觉得这也是封装的一种体现，而且在我最初接触响应式框架（Angular1）的时候，这是一种开发思路的重要转变

废话少说，我们的调用代码如下：
new ViewComponent({
  el: 'body',
  data: {
    isShowDetail: false,
    good: {
      id: '8faw8cs4fw9760zt7tnesini4qup5hid',
      name: 'iPhoneX',
      cpuNum: 1,
      memory: 1073741824,
      brand: 'iPhone',
      category: 'phone',
      color: 'black'
    }
  },
  methods: {
    switchDetail () {
      this.data.isShowDetail != this.data.isShowDetail
    }
  },
  render: function () {
    // 清除旧的DOM
    let root = document.querySelector(this.el)
    let childNodes = root.childNodes
    for (let i = 0; i < childNodes.length; i++) {
      childNodes[i].remove()
    }
    // 生成新的DOM
    let children = [
      this.createElement('div', { class: 'abstract' }, [
        this.createElement('div', { class: 'name' }),
        this.createElement('div', { class: 'brand' }),
        this.createElement('span', { class: 'switch', click: this.methods.switchDetail })
      ])
    ]
    if (this.isShowDetail) {
      children.push(
        this.createElement('div', { class: 'item' }, this.data.good.cpuNum),
        this.createElement('div', { class: 'item' }, this.data.good.memory),
        this.createElement('div', { class: 'item' }, this.data.good.category),
        this.createElement('div', { class: 'item' }, this.data.good.color)
      )
    }
    this.createElement('div', { class: 'good-detail' }, 
      this.createElement('div', { class: 'detail' }, children)
    )
  }
})

看到这个恶心的render，我觉得大家想要骂我，响应式框架的目的就是要将前端从拼接DOM的繁琐中解脱出来，但是这个render所做的事情，它的麻烦程度一点都不亚于拼接DOM，还是那句话，只有我们认识到了这么做多么麻烦，我们才更能理解template和jsx为何而存在

接下来我们再看ViewComponent的实现：
看之前希望大家带着这样一个问题：我们在switchDetail中只是改变了this.data.isShowDetail这个数据，并没有重新调用render，因此VueComponent内部肯定有一套机制，它通过这套机制就知道this.data.isShowDetail这个数据变化了，进而帮我们调用render，那这个机制要如何实现呢？


调用方式优化：this.data.good.cpuNum -> this.good.cpuNum