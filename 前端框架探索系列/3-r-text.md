我们从最简单的例子开始分析——如何将data中的数据展示到页面上：
let app = new ViewComponent({
  $el: '#app',
  data: {
    msg: 'hello'
  },
  template: '<div r-text="msg"></div>'
})

我们的目的就是将上述template解析成
<div>hello</div>
并插入到id为app的元素中去

实际上，我们最主要的目的就是将template中r-text这个规则解析出来，并和这个div做绑定

以下是我们现有的代码：
function ViewComponent (options) {
  this.$el = document.querySelector(options.el)
  this.data = options.data
  this.methods = options.methods
  this.template = options.template
  this.created = options.created
  this._init()
}

ViewComponent.prototype._init = function () {}

ViewComponent.prototype.created = function () {
  this.options.created && this.options.created()
}

我们将解析规则的工作放到_init中

template是一个字符串，而我们最终想要的是dom节点，将一个字符串转化为dom节点有什么方法呢？
innerHTML我们是很熟悉的，在此处我们也知道这段template是要加到#app中，所以我们可以很自然地这么做：
ViewComponent.prototype._init = function () {
  this.$el.innerHTML = this.template
}
现在我们在实例化根组件，所以把template放到哪个父级，这是很明确的，不过需要注意，在后期我们再实例化子组件的时候会看到，在init中是没法确定父级是谁的，因此我们在这里采用一种比较迂回的方案：
ViewComponent.prototype._init = function () {
  // 先建一个游离的div，存放由innerHTML转换成的dom
  let oDiv = document.createElement('div')
  oDiv.innerHTML = this.template
  // 再替换掉$el（此时$el就已经确定了）
  this.$el.parentNode.replaceElement(this.$el, oDiv.childNodes[0])
}

注意：为了降低代码的复杂度，我们规定：组件的根节点只能有一个，如果多余1个，只认第1个，从最后replace的过程中也能看得出来：
this.$el.parentNode.replaceElement(this.$el, oDiv.childNodes[0])

上面的实现看起来和直接赋值innerHTML似乎没什么区别，而且大家对“此时$el就已经确定了”也会有疑问，为什么这个时候$el就准备好了呢？

首先要明确，我们不传$el的情况，其实是针对子组件来说的
实际上在之后的实现中，我们会发现，在replace前面会执行一步重要操作——compile编译

compile会分析template，找到组件的父级，将这个父级元素给$el，举例来说：
商品列表组件的template如下：
`
  <table class="goods-list">
    <thead>
      <c-goods-list-head></c-goods-list-head>
    </thead>
    <tbody>
      <c-good-item></c-good-item>
      <c-good-item></c-good-item>
    </tbody>
  </table>
`

我们预先会定义表头组件（c-goods-list-head）的一系列配置：
let tHeadOptions = {
  data: {},
  methods: {},
  template: `
    <tr>
      <th>商品名称</th>
      <th>商品分类</th>
      <th>商品价格</th>
      <th>商品规格</th>
      <th>操作</th>
    </tr>
  `
}

可以发现，里面没有$el

但是这个表头组件（c-goods-list-head）在父组件compile编译的过程中，就会识别出它的$el应该是<c-goods-list-head>对象
现在不明白也没关系，将来讲到子组件编译，大家自然会清楚

话题再回到我们的问题当中，下一步就需要拿到游离的oDiv下子节点的r-text规则，代码如下：
let regIsRule = /^r-(\w+)/i
ViewComponent.prototype._init = function () {
  // 先建一个游离的div，存放由innerHTML转换成的dom
  let oDiv = document.createElement('div')
  oDiv.innerHTML = this.template

  // 取到r-text属性，并解析
  let firstChild = oDiv.childNodes[0]
  let aAttrs = firstChild.attributes
  for (let j = 0; j < aAttrs.length; j++) {
    let aMatched = regIsRule.match(aAttrs[i].name)
    let value = aAttrs[i].value
    if (aMatched && aMatched[1] === 'text') {
      firstChild.innerHTML = this.data[value]
    }
    firstChild.removeAttribute(aMatched[0])
  }

  // 再替换掉$el（此时$el就已经确定了）
  this.$el.parentNode.replaceElement(firstChild, this.$el)
}

接下来，我们在此基础上再添加一个功能，添加一个按钮，点这个按钮的时候，将内容变为hello1，调用代码如下：
let app = new ViewComponent({
  $el: '#app',
  data: {
    msg: 'hello'
  },
  methods: {
    change: function () {
      this.msg = 'hello1'
    }
  },
  template: `
  <div class="app">
    <div r-text="msg"></div>
    <button m-click="change">change</button>
  </div>
  `
})

可以看到，我们给按钮加了一个自定义属性m-click，它的值代表一个事件，这个事件我们定义在初始化参数中的methods对象里面，我们首先来思考一下这个新功能对我们的框架的改变：
1、需要解析m-click，并在解析完后给button绑定change事件
2、我们已经解析了r-text指令，又解析了m-click指令，之后还要解析r-if、r-for，这个解析的过程是必须要抽象出来的，所以我们一定要对指令Directive做封装
3、绑定了事件之后，按钮点击会执行this.msg = 'hello1'，我们期望执行完这行代码之后<div r-text="msg">中的内容会自动更新，而不是我们手动获取这个元素，将里面的innerHTML做对应的更改，Vue中的做法是使用defineReactive，我们也会用该方法实现，不过我们需要思考，有没有什么其他方法呢？
4、我们在真正解析m-click，给button绑定事件的时候一定会有这样的片段：
let _this = this
oBtn.addEventListener('click', function () {
  // 这里的value自然就是change
  this.methods[value].call(_this)
})
在这个代码中我们要思考：这里面的_this是谁？是当前的Vue对象，Vue对象上只有data、methods、template、$el、options这些属性，以及created、_init这些方法，因此，理论上讲，我们的回调中的this也应该是Vue对象：
change: function () {
  this.msg = 'hello1'
}
但为了避免过长的属性访问，我们直接通过this.msg、而不是this.data.msg来取值的，那该如何跨过data这一层来访问呢？

我们挨个来看，首先解析m-click，这时遇到一个困难，上一个例子我们的template很简单，只有一个元素，因此完全可以通过
firstChild.innerHTML = this.data[value]
的方式来得到该给哪个元素设置内容

但实际上r-text的内容可以设置在任意的template元素上，m-click也是相同道理，所以为了精确、完整地识别这些rules、methods，我们一定需要从template的根节点，依次向内遍历，将每个节点上的指令取出来并分析

简单总结一下：对每个dom元素的操作都分为如下几步：
1、收集该dom元素的指令，可以通过attributes属性，再通过前缀过滤出哪些是指令
2、逐个解析这些指令
3、遍历该dom元素的子元素，再对每个子元素做上述操作

由此可以看出，我们将会有一个递归遍历dom的过程，而递归一定需要一个函数，不能是零散的逻辑，我们把这个函数命名为——编译（compile）