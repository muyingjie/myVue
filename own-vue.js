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

function toString (val) {
  return val == null
    ? ''
    : typeof val === 'object'
      ? JSON.stringify(val, null, 2)
      : String(val)
}

function toNumber (val) {
  const n = parseFloat(val);
  return isNaN(n) ? val : n
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
installRenderHelpers(ViewComp.prototype)
function installRenderHelpers (target) {
  // target._o = markOnce;
  target._n = toNumber;
  target._s = toString;
  target._l = renderList;
  target._t = renderSlot;
  // target._q = looseEqual;
  // target._i = looseIndexOf;
  // target._m = renderStatic;
  // target._f = resolveFilter;
  // target._k = checkKeyCodes;
  // target._b = bindObjectProps;
  // target._v = createTextVNode;
  target._e = createEmptyVNode;
  // target._u = resolveScopedSlots;
  // target._g = bindObjectListeners;
  target._c = (a, b, c, d) => createElement(vm, a, b, c, d, false);
}

function renderList (
  val,
  render
) {
  let ret, i, l, keys, key;
  if (Array.isArray(val) || typeof val === 'string') {
    ret = new Array(val.length);
    for (i = 0, l = val.length; i < l; i++) {
      ret[i] = render(val[i], i);
    }
  } else if (typeof val === 'number') {
    ret = new Array(val);
    for (i = 0; i < val; i++) {
      ret[i] = render(i + 1, i);
    }
  } else if (isObject(val)) {
    keys = Object.keys(val);
    ret = new Array(keys.length);
    for (i = 0, l = keys.length; i < l; i++) {
      key = keys[i];
      ret[i] = render(val[key], key, i);
    }
  }
  if (isDef(ret)) {
    (ret)._isVList = true;
  }
  return ret
}

function renderSlot (
  name,
  fallback,
  props,
  bindObject
) {
  const scopedSlotFn = this.$scopedSlots[name];
  let nodes;
  if (scopedSlotFn) { // scoped slot
    props = props || {};
    if (bindObject) {
      if ("development" !== 'production' && !isObject(bindObject)) {
        warn(
          'slot v-bind without argument expects an Object',
          this
        );
      }
      props = extend(extend({}, bindObject), props);
    }
    nodes = scopedSlotFn(props) || fallback;
  } else {
    const slotNodes = this.$slots[name];
    // warn duplicate slot usage
    if (slotNodes) {
      if ("development" !== 'production' && slotNodes._rendered) {
        warn(
          `Duplicate presence of slot "${name}" found in the same render tree ` +
          `- this will likely cause render errors.`,
          this
        );
      }
      slotNodes._rendered = true;
    }
    nodes = slotNodes || fallback;
  }

  const target = props && props.slot;
  if (target) {
    return this.$createElement('template', { slot: target }, nodes)
  } else {
    return nodes
  }
}
const createEmptyVNode = (text = '') => {
  const node = new VNode();
  node.text = text;
  node.isComment = true;
  return node
};
function createElement (
  context,
  tag,
  data,
  children,
  normalizationType,
  alwaysNormalize
) {
  if (Array.isArray(data) || isPrimitive(data)) {
    normalizationType = children;
    children = data;
    data = undefined;
  }
  if (isTrue(alwaysNormalize)) {
    normalizationType = ALWAYS_NORMALIZE;
  }
  return _createElement(context, tag, data, children, normalizationType)
}
function _createElement (
  context,
  tag,
  data,
  children,
  normalizationType
) {
  if (isDef(data) && isDef((data).__ob__)) {
    "development" !== 'production' && warn(
      `Avoid using observed data object as vnode data: ${JSON.stringify(data)}\n` +
      'Always create fresh vnode data objects in each render!',
      context
    );
    return createEmptyVNode()
  }
  // object syntax in v-bind
  if (isDef(data) && isDef(data.is)) {
    tag = data.is;
  }
  if (!tag) {
    // in case of component :is set to falsy value
    return createEmptyVNode()
  }
  // support single function children as default scoped slot
  if (Array.isArray(children) &&
    typeof children[0] === 'function'
  ) {
    data = data || {};
    data.scopedSlots = { default: children[0] };
    children.length = 0;
  }
  if (normalizationType === ALWAYS_NORMALIZE) {
    children = normalizeChildren(children);
  } else if (normalizationType === SIMPLE_NORMALIZE) {
    children = simpleNormalizeChildren(children);
  }
  let vnode, ns;
  if (typeof tag === 'string') {
    let Ctor;
    ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag);
    if (config.isReservedTag(tag)) {
      // platform built-in elements
      vnode = new VNode(
        config.parsePlatformTagName(tag), data, children,
        undefined, undefined, context
      );
    } else if (isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
      // component
      vnode = createComponent(Ctor, data, context, children, tag);
    } else {
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      vnode = new VNode(
        tag, data, children,
        undefined, undefined, context
      );
    }
  } else {
    // direct component options / constructor
    vnode = createComponent(tag, data, context, children);
  }
  if (isDef(vnode)) {
    if (ns) applyNS(vnode, ns);
    return vnode
  } else {
    return createEmptyVNode()
  }
}
