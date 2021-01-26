其实前端（在此主要指浏览器端）的工作总体上可以概括为两大部分：展示和交互，而交互又是在展示的基础之上才有的，因此对数据进行展示是一切工作的基础

我们不妨举一个非常常见的例子，将一个描述商品的对象的信息展示在页面上：
{
  id: '8faw8cs4fw9760zt7tnesini4qup5hid',
  name: 'iPhoneX',
  cpuNum: 1,
  memory: 1073741824,
  brand: 'iPhone',
  category: 'phone',
  color: 'black'
}

在Vue、React等视图层框架出现之前，我们常写出这样的代码：
<body>
  <div class="good-detail">
    <div class="item name"></div>
    <div class="item cpu-num"></div>
    <div class="item memory"></div>
    <div class="item brand"></div>
    <div class="item category"></div>
    <div class="item color"></div>
  </div>
</body>
<script src="../frameworkExplore/jQuery3.4.js"></script>
<script>
let good = {
  id: '8faw8cs4fw9760zt7tnesini4qup5hid',
  name: 'iPhoneX',
  cpuNum: 1,
  memory: 1073741824,
  brand: 'iPhone',
  category: 'phone',
  color: 'black'
}
$(".name").html('名称：' + good.name)
$(".cpu-num").html('CPU：' + good.cpuNum)
$(".memory").html('内存：' + good.memory)
$(".brand").html('品牌：' + good.brand)
$(".category").html('分类：' + good.category)
$(".color").html('颜色：' + good.color)
</script>
这种代码会有下面这样一些繁琐之处：
1、可以看到，我们需要给每个item都起一个名字，放在它的class里面，这个名字就是为了能够在js中选中它，给它赋值
如果没有jQuery，我们可能还得在js中定义很多变量的名字，这些变量专门用来保存获取的DOM

2、对于某些表格、列表之类的数据，通常是在HTML里先定义一个空壳子(比如$('<table>'))，再在js里拼接dom，将拼好的dom塞到空壳子中($('<table>').append($('<thead>')...))
这样就导致HTML代码散落在两个地方，非常非常乱
如果css规划不好，代码中再用添加一些css样式，这种代码写完都不想维护
而且有时也很难权衡到底是将HTML直接写在body中，还是通过js动态创建插入到body里面

在面向对象思想中有一点叫封装，我是这么理解这个封装的：
把同一模块或同一功能的成员放在一起统一管理，从而抽象成一个组件，这个过程就是封装
因为一个模块内的成员耦合度一定是很高的，上面的代码之所以不好看就是因为数据（在此处是good）和结构（HTML部分）离地太远，于是就要通过变量的形式把它们关联在一起
如果我们在js里动态创建一堆dom生成一个列表时，就会发现不需要这么多变量，因为二者离得足够近

于是，很自然有这样一个思路，将一个页面上的各个部分拆成一个个组件，每个组件各自管理各自的数据、样式、结构
然后我们定义一套统一的算法，把数据、样式、结构通过配置的方式传入，然后这个算法按照我们期望的方式渲染出来
这个算法我们可以理解为一个类，由于它描述的是页面上的一个个组件，所以我们可以用ViewComponent来作为它的名字：
function ViewComponent (options) {
  //...
}

再来详细说一下它的入参
上面我们只是有了个大概的印象，要把组件的数据、样式、结构传进来，因此可以想到会有data、style、html这些参数
style部分我们暂时先不考虑
data部分比较直观，直接将json传入即可
html部分需要在原来的基础上做一些修改，此处我们不能仅仅告诉ViewComponent一个死的结构，”结构“说白了就是承载数据的载体，所以在结构中必须体现出和数据的绑定关系是怎么样的，所以这里的结构更像是渲染规则，我们可以叫做renderRule，所以我们的入参类似这样：
new ViewComponent({
  el: 'body',
  data: {
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
  renderRule: {
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
})

我们来详细解释一下这个入参
首先data就不用说了，比较直观
其次是renderRule，在此我们期望这个参数通过json的方式描述页面的结构是什么样
例如这个json的第一层就代表一个class为good-detail的div，这个div的子节点用children表示，children数组中每个对象又和good-detail类似
这样我们就可以通过递归遍历renderRule来将这些元素创建出来，按照这个渲染规则完成渲染
值得注意的是我们还传了el参数，这个参数代表我们将renderRule渲染出来的dom挂载到哪个元素上，此处是挂载到body上

入参定义好了，接下来就要看怎么实现ViewComponent这个构造函数了
我们在此先实现一个最简单的版本，简单到满足这次的需求即可
function isArray (o) {
  return Object.prototype.toString.call(o) === '[object Array]'
}
function ViewComponent (options) {
  this.el = document.querySelector(options.el)
  this.data = options.data
  this.renderRule = options.renderRule
  this.renderedElement = null
  this.init()
}
ViewComponent.prototype.init = function () {
  this.renderedElement = this.createElementsByRenderRule()
}
ViewComponent.prototype.createElementsByRenderRule = function () {
  let o = this.createElementByRenderRuleObject(this.renderRule)
  if (isArray(this.renderRule.children)) {
    for (let i = 0; i < this.renderRule.children.length; i++) {
      let c = this.createElementByRenderRuleObject(this.renderRule.children[i])
      o.appendChild(c)
    }
  }
  this.el.appendChild(o)
}
ViewComponent.prototype.createElementByRenderRuleObject = function (rro) {
  let o = document.createElement(rro.tag)
  o.className = rro.class
  if (rro.content) {
    let a = parse(rro.content)
    let handledProperty = this.getComponentDataProperty(a)
    let templateVariableBound = /{{\S+}}/g
    let handledContent = rro.content.replace(templateVariableBound, handledProperty)
    let t = document.createTextNode(handledContent)
    o.appendChild(t)
  }
  return o
}
ViewComponent.prototype.getComponentDataProperty = function (a) {
  let l = a.length
  let r = this.data

  for (let i = 0; i < l; i++) {
    let s = a[i]
    r = r[s]
    if (r === undefined) return
  }
  return r
}
function parse (t) {
  let templateVariableBound = /{{(\S+)}}/
  let a = t.match(templateVariableBound)
  return a[1].split('.')
}

new ViewComponent({
  el: 'body',
  data: {
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
  renderRule: {
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
})

使用过Vue和React的各位，看到renderRule这个入参一定觉得非常熟悉，但又感觉别扭，因为Vue中是用一个名为template的key来定义模板的
而且template采用的格式是类HTML，就像下面这样:
  <div class="good-detail">
    <div class="item">{{good.name}}</div>
    <div class="item">{{good.cpuNum}}</div>
    <div class="item">{{good.memory}}</div>
    <div class="item">{{good.brand}}</div>
    <div class="item">{{good.category}}</div>
    <div class="item">{{good.color}}</div>
  </div>
可以思考一个问题，我们都是想要定义一套规则，Vue为什么这样定义，而不是和我们的renderRule一样呢？
首先说，我们自创的这种renderRule的方式对js非常友好
这句话怎么理解呢？
从上面的代码中可以看出，我们创建dom时只通过createElementsByRenderRule、createElementByRenderRuleObject两个方法就基本完成了
而如果写成类似Vue中template的形式，就需要分析这个template，template本身是一个很大的字符串，Vue逐个遍历这个字符串中的每个字符，生成AST，然后根据AST生成中间代码，即通过_c、_l、_s等方法构成的一个函数，这些_c、_l、_s方法会生成最终的dom

其实我之前有一个疑问，为什么不可以将template直接作为HTML，然后将它作为innerHTML塞到el中，据我所知，和我有相同想法的人有很多
但稍微思考一下就会发现实现难度会很大，如果这么做，我们可能就会解决诸如下面这样的问题：
找到v-for对应的元素，然后将其遍历若干遍，具体遍历多少遍还得取出里面的变量，再插入到原有位置
找到v-if对应的元素，然后取出v-if里面的表达式，判断当前条件是否满足，然后将满足条件的字符串加工好放回原来的位置
这个代码可能就要写出非常复杂的正则，而且往回放的时候放的位置还会受之前插入或删除了多少字符串的影响，会非常复杂，实现成本很高很高
js是一门基于对象的语言，操作对象、数组是它最擅长的，与此相对应的，它很不擅长操作字符串，所以如果是直接对template这个字符串加工的话，一定会很麻烦，所以js走了传统编译的流程

以上纯属个人猜测哈，欢迎大家发表自己的想法、见解

那么template有什么优势呢？
首先，它很直观，既然是模板，那么利用我们最熟悉的HTML来表示它，非常合适，react里的jsx也是同样道理
其次，它够灵活，可以通过v-if、v-for等指令再结合变量控制dom的展示

反观我们的renderRule也，它只是个死的json，完全不具备灵活性，唯一变化的地方就是用{{}}包围起来的变量，但要想实现和v-if类似的某些条件展示某个元素，某些条件展示另外的元素，是做不到的，因为renderRule在new ViewComponent调用的时候就已经确定，所以最终创建出来什么元素也是死的，如果有个重命名的功能，把good.name改一下，再保存，页面上是不会刷新成新的名字的
除此之外，我们的renderRule其实写起来相当繁琐，还特别不直观，如果是HTML，一眼看上去基本就能猜到页面是什么样，但是json的话从感官上来说就差很多了

这个灵活性的问题我们将在下一篇文章中解决，但直观性的问题，出于实现成本及难度的考虑，我们会稍稍改造，在本系列文章的最后，我们将做到完全和Vue一样，从模板解析到真正的dom

还有一个我个人的习惯想和大家分享：在写原型上的方法时，如果想要去取属性值，我通常尽量使用this.xxx的方式来获取，而不是通过参数来得到，这样可以确保获取、设置的是同一个地方的数据，如果是引用类型还好，因为改的都是一个对象，但如果是基础类型，很容易引起混乱，通过参数传来传去的话，感觉也不太利于维护

当然我们很清楚，实际的场合比上面的例子复杂很多，这些复杂的例子我都会单独抽离出来作为一个话题讨论，例如：
1、我们需要定义一个动态的渲染规则，因为数据、样式、结构同时还要接收用户的各种点击、滑动等等交互操作，操作完之后又会生成新的DOM
2、将这些操作全部抽象为数据的变动，进行再次渲染，也就是所谓的响应式要如何做？
3、到最后，我们还期望尽量以一个较小的成本来渲染
。。。。。。