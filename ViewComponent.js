let regIsRule = /^r-(\w+)/i
let regIsMethod = /^m-(\w+)/i
function ViewComponent (options) {
  this.$el = document.querySelector(options.$el)
  this.data = options.data
  this.methods = options.methods
  this.template = options.template
  this.created = options.created
  this._init()
}

ViewComponent.prototype._init = function () {
  // 先建一个游离的div，存放由innerHTML转换成的dom
  let oDiv = document.createElement('div')
  oDiv.innerHTML = this.template

  let firstChild = oDiv.childNodes[0]
  this.compile(firstChild)

  // 再替换掉$el（此时$el就已经确定了）
  this.$el.parentNode.replaceChild(firstChild, this.$el)
}

ViewComponent.prototype.compile = function (el) {
  let aAttrs = el.attributes
  for (let i = 0; i < aAttrs.length; i++) {
    let aMatchedRule = aAttrs[i].name.match(regIsRule)
    let ruleValue = aAttrs[i].value
    // 取到r-text属性，并解析
    if (aMatchedRule && aMatchedRule[1] === 'text') {
      el.innerHTML = this.data[ruleValue]
    }
    el.removeAttribute(aMatchedRule[0])

    let aMatchedMethod = aAttrs[i].name.match(regIsMethod)
    let methodValue = aAttrs[i].value
    if (aMatchedMethod && aMatchedMethod.length > 0) {
      el.addEventListener(aMatchedMethod[1], this.methods[methodValue])
    }
  }
  if (el.childNodes.length > 0) {
    for (let i = 0; i < el.childNodes.length; i++) {
      this.compile(el.childNodes[i])
    }
  }
}

ViewComponent.prototype.created = function () {
  this.options.created && this.options.created()
}