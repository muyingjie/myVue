// utils
const hasOwnProperty = Object.prototype.hasOwnProperty
function hasOwn (obj, key) {
  return hasOwnProperty.call(obj, key)
}

function error (s) {
  console.error(s)
}

function isObject (obj) {
  return obj !== null && typeof obj === 'object'
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
  let options = this._options
  let _data = data.call(this)
  let _props = this._options.props
  let _methods = this._options.methods
  let keys = Object.keys(_data)
  this._data = _data
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
  this.dep = new Dep()
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
function Watcher (vm, fn, cb, options) {
  this.vm = vm
  this.getter = fn
  this.cb = cb
  this.value = undefined
  this.deps = []

  this.get()
}
Watcher.prototype.addDep = function (dep) {
  if (this.deps.indexOf(dep) === -1) {
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
