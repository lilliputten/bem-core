/**
 * @module i-bem-dom__events
 */
modules.define(
    'i-bem-dom__events',
    [
        'i-bem__internal',
        'i-bem-dom__collection',
        'inherit',
        'identify',
        'objects',
        'functions'
    ],
    function(
        provide,
        bemInternal,
        BemDomCollection,
        inherit,
        identify,
        objects,
        functions) {

var undef,
    winNode = window,
    docNode = document,
    winId = identify(winNode),
    docId = identify(docNode),
    eventStorage = {},

    /**
     * @class EventManager
     */
    EventManager = inherit(/** @lends EventManager.prototype */{
        /**
         * @constructs
         * @param {Object} params EventManager parameters
         * @param {Function} handlerWrapper Wrapper function to build event handler
         * @param {Function} eventBuilder Function to build event
         */
        __constructor : function(params, handlerWrapper, eventBuilder) {
            this._params = params;
            this._handlerWrapper = handlerWrapper;
            this._eventBuilder = eventBuilder;
            this._storage = {};
        },

        /**
         * Adds an event handler
         * @param {String|Object|events:Event} e Event type
         * @param {*} [data] Additional data that the handler gets as e.data
         * @param {Function} fn Handler
         * @returns {EventManager} this
         */
        on : function(e, data, fn, _fnCtx, _isOnce) {
            if(typeof e === 'string' && e.indexOf(' ') > -1) {
                e.split(' ').forEach(function(event) {
                    this.on(event, data, fn, _fnCtx, _isOnce);
                }, this);

                return this;
            }

            var params = this._params,
                event = this._eventBuilder(e, params, 'on');

            if(functions.isFunction(data)) {
                _isOnce = _fnCtx;
                _fnCtx = fn;
                fn = data;
                data = undef;
            }

            var fnStorage = this._storage[event] || (this._storage[event] = {}),
                fnId = identify(fn, _fnCtx);

            if(!fnStorage[fnId]) {
                var bindDomNodes = params.bindDomNodes,
                    bindClassName = params.bindClassName,
                    _this = this,
                    handler = fnStorage[fnId] = this._handlerWrapper(
                        _isOnce?
                            function() {
                                _this.un(e, fn, _fnCtx);
                                fn.apply(this, arguments);
                            } :
                            fn,
                        data,
                        _fnCtx,
                        fnId);

                bindDomNodes.forEach(function(domNode) {
                    domNode.addEventListener(event, handler, false);
                });
            }

            return this;
        },

        /**
         * Adds an event handler
         * @param {String} e Event type
         * @param {*} [data] Additional data that the handler gets as e.data
         * @param {Function} fn Handler
         * @returns {EventManager} this
         */
        once : function(e, data, fn, _fnCtx) {
            if(functions.isFunction(data)) {
                _fnCtx = fn;
                fn = data;
                data = undef;
            }

            return this.on(e, data, fn, _fnCtx, true);
        },

        /**
         * Removes event handler or handlers
         * @param {String|Object|events:Event} [e] Event type
         * @param {Function} [fn] Handler
         * @returns {EventManager} this
         */
        un : function(e, fn, _fnCtx) {
            var argsLen = arguments.length;
            if(argsLen) {
                if(typeof e === 'string' && e.indexOf(' ') > -1) {
                    e.split(' ').forEach(function(event) {
                        this.un(event, fn, _fnCtx);
                    }, this);

                    return this;
                }

                var params = this._params,
                    event = this._eventBuilder(e, params, 'un');

                if(argsLen === 1) {
                    this._unbindByEvent(this._storage[event], event);
                } else {
                    var wrappedFn,
                        fnId = identify(fn, _fnCtx),
                        fnStorage = this._storage[event],
                        bindDomNodes = params.bindDomNodes,
                        bindClassName = params.bindClassName;

                    if(wrappedFn = fnStorage && fnStorage[fnId])
                        delete fnStorage[fnId];

                    var handler = wrappedFn || fn;

                    bindDomNodes.forEach(function(domNode) {
                        domNode.removeEventListener(event, handler);
                    });
                }
            } else {
                objects.each(this._storage, this._unbindByEvent, this);
            }

            return this;
        },

        _unbindByEvent : function(fnStorage, e) {
            var params = this._params,
                bindDomNodes = params.bindDomNodes,
                bindClassName = params.bindClassName;

            fnStorage && objects.each(fnStorage, function(fn) {
                bindDomNodes.forEach(function(domNode) {
                    domNode.removeEventListener(e, fn);
                });
            });
            this._storage[e] = null;
        }
    }),
    buildForEachEventManagerProxyFn = function(methodName) {
        return function() {
            var args = arguments;

            this._eventManagers.forEach(function(eventManager) {
                eventManager[methodName].apply(eventManager, args);
            });

            return this;
        };
    },
    /**
     * @class CollectionEventManager
     */
    CollectionEventManager = inherit(/** @lends CollectionEventManager.prototype */{
        /**
         * @constructs
         * @param {Array} eventManagers Array of event managers
         */
        __constructor : function(eventManagers) {
            this._eventManagers = eventManagers;
        },

        /**
         * Adds an event handler
         * @param {String|Object|events:Event} e Event type
         * @param {Object} [data] Additional data that the handler gets as e.data
         * @param {Function} fn Handler
         * @returns {CollectionEventManager} this
         */
        on : buildForEachEventManagerProxyFn('on'),

        /**
         * Adds an event handler
         * @param {String} e Event type
         * @param {Object} [data] Additional data that the handler gets as e.data
         * @param {Function} fn Handler
         * @returns {CollectionEventManager} this
         */
        once : buildForEachEventManagerProxyFn('once'),

        /**
         * Removes event handler or handlers
         * @param {String|Object|events:Event} [e] Event type
         * @param {Function} [fn] Handler
         * @returns {CollectionEventManager} this
         */
        un : buildForEachEventManagerProxyFn('un')
    }),
    /**
     * @class EventManagerFactory
     * @exports i-bem-dom__events:EventManagerFactory
     */
    EventManagerFactory = inherit(/** @lends EventManagerFactory.prototype */{
        __constructor : function(getEntityCls, getEntity) {
            this._storageSuffix = identify();
            this._getEntityCls = getEntityCls;
            this._getEntity = getEntity;
            this._eventManagerCls = EventManager;
        },

        /**
         * Instantiates event manager
         * @param {Function|i-bem-dom:BemDomEntity} ctx BemDomEntity class or instance
         * @param {Function|String|Object|Elem|BemDomCollection|document|window} bindCtx context to bind
         * @param {Element|NodeList|HTMLCollection} bindScope bind scope
         * @returns {EventManager}
         */
        getEventManager : function(ctx, bindCtx, bindScope) {
            if(bindCtx instanceof BemDomCollection) {
                return new CollectionEventManager(bindCtx.map(function(entity) {
                    return this.getEventManager(ctx, entity, bindScope);
                }, this));
            }

            var ctxId = identify(ctx),
                ctxStorage = eventStorage[ctxId],
                storageSuffix = this._storageSuffix,
                isBindToInstance = typeof ctx !== 'function',
                ctxCls,
                className = '';

            if(isBindToInstance) {
                ctxCls = ctx.__self;
            } else {
                ctxCls = ctx;
                className = ctx._buildClassName();
            }

            var params = this._buildEventManagerParams(bindCtx, bindScope, className, ctxCls),
                storageKey = params.key + storageSuffix;

            if(!ctxStorage) {
                ctxStorage = eventStorage[ctxId] = {};
                if(isBindToInstance) {
                    ctx._events().on({ modName : 'js', modVal : '' }, function() {
                        params.bindToArbitraryDomNode && ctxStorage[storageKey] &&
                            ctxStorage[storageKey].un();
                        delete ctxStorage[ctxId];
                    });
                }
            }

            return ctxStorage[storageKey] ||
                (ctxStorage[storageKey] = this._createEventManager(ctx, params, isBindToInstance));
        },

        _buildEventManagerParams : function(bindCtx, bindScope, ctxClassName, ctxCls) {
            var res = {
                bindEntityCls : null,
                bindDomNodes : bindScope instanceof Element? [bindScope] : bindScope,
                bindToArbitraryDomNode : false,
                bindClassName : ctxClassName,
                ctxClassName : ctxClassName,
                key : ''
            };

            if(bindCtx) {
                var typeOfCtx = typeof bindCtx;

                if (bindCtx === winNode || bindCtx === docNode || bindCtx instanceof Element) {
                    res.bindDomNodes = bindCtx === docNode ? [docNode.documentElement] : [bindCtx];
                    res.key = identify(bindCtx);
                    res.bindToArbitraryDomNode = true;
                } else if(bindCtx.length && typeOfCtx !== 'string') { // NOTE: duck-typing check for collection of DOM nodes
                    res.bindDomNodes = bindCtx;
                    res.key = identify.apply(null, bindCtx);
                    res.bindToArbitraryDomElem = true;
                } else if(typeOfCtx === 'object' && bindCtx.__self) { // bem entity instance
                    res.bindDomNodes = bindCtx.domNodes;
                    res.key = bindCtx._uniqId;
                    res.bindEntityCls = bindCtx.__self;
                } else if(typeOfCtx === 'string' || typeOfCtx === 'object' || typeOfCtx === 'function') {
                    var blockName, elemName, modName, modVal;
                    if(typeOfCtx === 'string') { // elem name
                        blockName = ctxCls._blockName;
                        elemName = bindCtx;
                    } else if(typeOfCtx === 'object') { // bem entity with optional mod val
                        blockName = bindCtx.block?
                            bindCtx.block.getName() :
                            ctxCls._blockName;
                        elemName = typeof bindCtx.elem === 'function'?
                            bindCtx.elem.getName() :
                            bindCtx.elem;
                        modName = bindCtx.modName;
                        modVal = bindCtx.modVal;
                    } else if(bindCtx.getName() === bindCtx.getEntityName()) { // block class
                        blockName = bindCtx.getName();
                    } else { // elem class
                        blockName = ctxCls._blockName;
                        elemName = bindCtx.getName();
                    }

                    var entityName = bemInternal.buildClassName(blockName, elemName);
                    res.bindEntityCls = this._getEntityCls(entityName);
                    res.bindClassName = res.key = entityName + bemInternal.buildModPostfix(modName, modVal);
                }
            } else {
                res.bindEntityCls = ctxCls;
            }

            return res;
        },

        _getEventActors : function(e, ctx, params, isInstance) {
            var getEntity = this._getEntity,
                instance,
                targetDomNode,
                domNode = e.target;

            if(isInstance) {
                instance = ctx;

                if(params.bindClassName) {
                    do {
                        if(domNode.classList.contains(params.bindClassName)) {
                            targetDomNode = domNode;
                            break;
                        }
                        if(domNode === e.currentTarget) break;
                    } while(domNode = domNode.parentElement);

                    targetDomNode || (instance = undefined);
                }
            } else {
                do {
                    if(!targetDomNode) {
                        if(domNode.classList.contains(params.bindClassName)) {
                            targetDomNode = domNode;
                        } else continue;
                    }

                    if(domNode.classList.contains(params.ctxClassName)) {
                        instance = getEntity(domNode, ctx);
                        break;
                    }
                } while(domNode = domNode.parentElement);
            }

            return { instance : instance, targetDomNode : targetDomNode };
        },

        _createEventManager : function(ctx, params, isInstance) {
            throw new Error('not implemented');
        }
    });

provide({
    EventManagerFactory : EventManagerFactory
});

});
