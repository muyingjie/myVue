// utils
const hasOwnProperty = Object.prototype.hasOwnProperty
function hasOwn (obj, key) {
  return hasOwnProperty.call(obj, key)
}

function error (s) {
  console.error(s)
}
// utils function
function noop () {}

function ViewComp (options) {
  this._init(options)
}
ViewComp.prototype._init = function (options) {
  this._options = options
  this._initData(options.data)
  this._mount(options.el)
}
ViewComp.prototype._initData = function (data) {
  if (!data || typeof data !== 'function') {
    error('data option must be a function')
    return
  }
  let _data = data.call(this)
  let _props = this._options.props
  let _methods = this._options.methods
  let keys = Object.keys(_data)
  keys.forEach(k => {
    let isDefinedInMethodOrProp = false
    if (_methods && hasOwn(_methods, k)) {
      error(`'${k}' has been defined in methods, so it can't be redefined in the data object`)
      isDefinedInMethodOrProp = true
    }
    if (_props && hasOwn(_props, k)) {
      error(`'${k}' has been defined in methods, so it can't be redefined in the data object`)
      isDefinedInMethodOrProp = true
    }
    if (isDefinedInMethodOrProp) return
    proxy(this, k, '_data')
  })
  observe(_data)
}
function proxy (obj, k, proxyObjectKeyName) {
  Object.defineProperty(obj, k, {
    enumerable: true,
    configurable: true,
    get: function () {
      return obj[proxyObjectKeyName][k]
    },
    set: function (v) {
      obj[proxyObjectKeyName][k] = v
    }
  })
}
function observe (value) {
  if (!isObject(value)) return
  let ob = value.__ob__
  if (ob && ob instanceof Observer) return ob
  return new Observer(value)
}
function Observer (value) {
  this.value = value
  if (isObject(value)) {
    this.walk(value)
  }
}
Observer.prototype.walk = function (obj) {
  let keys = Object.keys(obj)
  for (let i = 0; i < keys.length; i++) {
    defineReactive(obj, keys[i])
  }
}
let curWatcher = null
function defineReactive (obj, key) {
  const dep = new Dep()
  let value = obj[key]
  let childOb = !observe(value)
  Object.defineProperty(obj, key, {
    get: function () {
      if (curWatcher) {
        dep.depend()
      }
      return value
    },
    set: function (newValue) {
      if (value === newValue) return
      value = newValue
      childOb = observe(newValue)
      dep.notify()
    }
  })
}
function Dep () {
  this.subs = []
}
Dep.prototype.addSub = function (sub) {
  this.subs.push(sub)
}
Dep.prototype.depend = function () {
  // 并没有直接将curWatcher加入subs中，而是将watcher和当前dep对象关联了起来，在watcher对象里面调用dep的addSub收集依赖
  if (curWatcher) {
    curWatcher.addDep(this)
  }
}
Dep.prototype.notify = function () {
  for (let i = 0, l = this.subs.length; i < l; i++) {
    this.subs[i].update()
  }
}
function isObject (obj) {
  return obj !== null && typeof obj === 'object'
}
function Watcher (vm, fn, cb, options) {
  this.vm = vm
  this.getter = fn
  this.cb = cb
  this.value = undefined
  this.deps = []

  this.get()
}
Watcher.prototype.addDep = function (dep) {
  if (!this.deps.has(dep)) {
    this.deps.push(dep)
    dep.addSub(this)
  }
}
Watcher.prototype.update = function () {
  this.run()
}
Watcher.prototype.run = function () {
  const value = this.get()
  if (value !== this.value) {
    let oldValue = this.value
    this.value = value
    this.cb.call(this.vm, value, oldValue)
  }
}
Watcher.prototype.get = function () {
  curWatcher = this
  let value = this.getter.call(this.vm)
  this.cleanupDeps()
  return value
}
Watcher.prototype.cleanupDeps = function () {
  this.deps = []
}
ViewComp.prototype._mount = function (el) {
  el = document.querySelector(el)
  const options = this._options
  if (!options.render) {
    // 可能从ViewComp单文件、template属性等里面取，最终都会转为render方法
    let template = options.template
    if (!template) {
      template = el.outerHTML
    }
    // 编译
    const { render } = compileToFunctions(template, this)
    options.render = render
  }
  // 执行真正的挂载过程，即将虚拟DOM转换为真实DOM
  return mountComponent(this, el)
}
function compileToFunctions (template, comp) {
  let res = {}
  let compiled = compile(template)
  res.render = createFunction(compiled.render)
  return res
}
function compile (template) {
  const ast = parse(template)
  // optimize(ast)
  const code = generate(ast)
  return {
    ast,
    render: code.render
  }
}
function parse (template) {
  parseHTML(template, {
    start: function (tag, attrs, unary, start, end) {}
  })
}
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// 匹配自定义标签
const ncname = '[a-zA-Z_][\\w\\-\\.]*'
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
// 匹配开始标签的开始部分
const startTagOpen = new RegExp(`^<${qnameCapture}`)
// 匹配开始标签的结束部分
const startTagClose = /^\s*(\/?)>/
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
// const doctype = /^<!DOCTYPE [^>]+>/i
const comment = /^<!\--/
// 匹配条件注释
// const conditionalComment = /^<!\[/

const isPlainTextElement = {
  script: true,
  style: true,
  textarea: true
}
const reCache = {}
const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t'
}
const encodedAttr = /&(?:lt|gt|quot|amp);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#10|#9);/g

function decodeAttr (value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

function parseHTML (html, options) {
  // 逐层解析标签时所需要的栈
  const stack = []
  // 字符流的读入位置
  let index = 0
  // last: 剩余还未 parse 的 html 字符串
  // lastTag: 存储着位于 stack 栈顶的元素
  let last = ''
  let lastTag = ''
  while (html) {
    last = html
    if (lastTag && isPlainTextElement[lastTag]) {
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!--([\s\S]*?)-->/g, '$1')
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    } else {
      let textEnd = html.indexOf('<')
      // 遇到了标签
      if (textEnd === 0) {
        // 是否为注释
        if (comment.test(html)) {
          const commentEnd = html.indexOf('-->')
          // 直接剔除
          advance(commentEnd + 3)
          continue
        }
        // 是否为结束标签
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }
        // 是否为开始标签
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          handleStartTag(startTagMatch)
          continue
        }
      }
      let text, rest, next
      if (textEnd >= 0) {
        rest = html.slice(textEnd)
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1)
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        }
        text = html.substring(0, textEnd)
        advance(textEnd)
      }
      if (textEnd < 0) {
        text = html
        html = ''
      }
    }
    // 没有匹配到任何东西
    if (html === last) {
      break
    }
  }
  // 检查栈是不是为空
  parseEndTag()
  function advance (n) {
    index += n
    html = html.substring(n)
  }
  function parseStartTag () {
    const start = html.match(startTagOpen)
    if (start) {
      const match = {
        tagName: start[1],
        attrs: [],
        start: index
      }
      advance(start[0].length)
      let end, attr
      // 查看接下来匹配的字符是不是'>'，即开始标签的结束符号
      // 如果不是结束符号'>'，则一定是属性，然后一直将所有属性匹配完
      while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
        advance(attr[0].length)
        match.attrs.push(attr)
      }
      if (end) {
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }
  function handleStartTag (match) {
    const tagName = match.tagName
    const unarySlash = match.unarySlash
    // 是否为自闭合标签，即一元标签
    const unary = !!unarySlash
    const l = match.attrs.length
    const attrs = new Array(l)
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]
      const value = args[3] || args[4] || args[5] || ''
      attrs[i] = {
        name: args[1],
        value: decodeAttr(value)
      }
    }
    // 如果不是一元标签，就入栈，stack用于检验标签嵌套是否合法
    if (!unary) {
      stack.push({
        tag: tagName,
        lowerCasedTag: tagName.toLowerCase(),
        attrs: attrs
      })
      lastTag = tagName
    }
    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }
  function parseEndTag (tagName) {
    let pos, lowerCasedTagName
    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
    }

    // Find the closest opened tag of the same type
    if (tagName) {
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }
    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }
      // Remove the open elements from the stack
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    }
  }
}
function mountComponent (vm, el) {
  vm.$el = el
  let updateComponent = () => {
    vm._update(vm._render())
  }
  new Watcher(vm, updateComponent, noop)
  return vm
}
ViewComp.prototype._render = function () {
  const vm = this
  const render = vm._options.render
  let vnode = render.call(vm, createVNode)
  return vnode
}

ViewComp.prototype._update = function (vnode) {
  const vm = this
  const prevVnode = vm._node
  const parentNode = vm.$el.parentNode

  vm._vnode = vnode
  if (!prevVnode) {
    vm.$el = patch(vm.$el, vnode, parentNode)
  } else {
    vm.$el = patch(prevVnode, vnode, parentNode)
  }
}
ViewComp.prototype.$watch = function (expOrFn, cb, options) {
  const vm = this
  options = options || {}
  const watcher = new Watcher(vm, expOrFn, cb, options)
  if (options.immediate) {
    cb.call(vm, watcher.value)
  }
  return function unwatchFn () {
    watcher.teardown()
  }
}
