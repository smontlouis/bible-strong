!function(e){var t={};function r(n){if(t[n])return t[n].exports;var i=t[n]={i:n,l:!1,exports:{}};return e[n].call(i.exports,i,i.exports,r),i.l=!0,i.exports}r.m=e,r.c=t,r.d=function(e,t,n){r.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:n})},r.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},r.t=function(e,t){if(1&t&&(e=r(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var n=Object.create(null);if(r.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var i in e)r.d(n,i,function(t){return e[t]}.bind(null,i));return n},r.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return r.d(t,"a",t),t},r.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},r.p="",r(r.s=1)}([function(e,t,r){},function(e,t,r){"use strict";r.r(t);var n=function(){},i={},o=[],a=[];function u(e,t){var r,u,s,l,c=a;for(l=arguments.length;l-- >2;)o.push(arguments[l]);for(t&&null!=t.children&&(o.length||o.push(t.children),delete t.children);o.length;)if((u=o.pop())&&void 0!==u.pop)for(l=u.length;l--;)o.push(u[l]);else"boolean"==typeof u&&(u=null),(s="function"!=typeof e)&&(null==u?u="":"number"==typeof u?u=String(u):"string"!=typeof u&&(s=!1)),s&&r?c[c.length-1]+=u:c===a?c=[u]:c.push(u),r=s;var p=new n;return p.nodeName=e,p.children=c,p.attributes=null==t?void 0:t,p.key=null==t?void 0:t.key,void 0!==i.vnode&&i.vnode(p),p}function s(e,t){for(var r in t)e[r]=t[r];return e}function l(e,t){null!=e&&("function"==typeof e?e(t):e.current=t)}var c="function"==typeof Promise?Promise.resolve().then.bind(Promise.resolve()):setTimeout;var p=/acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i,d=[];function f(e){!e._dirty&&(e._dirty=!0)&&1==d.push(e)&&(i.debounceRendering||c)(v)}function v(){for(var e;e=d.pop();)e._dirty&&P(e)}function m(e,t){return e.normalizedNodeName===t||e.nodeName.toLowerCase()===t.toLowerCase()}function h(e){var t=s({},e.attributes);t.children=e.children;var r=e.nodeName.defaultProps;if(void 0!==r)for(var n in r)void 0===t[n]&&(t[n]=r[n]);return t}function y(e){var t=e.parentNode;t&&t.removeChild(e)}function b(e,t,r,n,i){if("className"===t&&(t="class"),"key"===t);else if("ref"===t)l(r,null),l(n,e);else if("class"!==t||i)if("style"===t){if(n&&"string"!=typeof n&&"string"!=typeof r||(e.style.cssText=n||""),n&&"object"==typeof n){if("string"!=typeof r)for(var o in r)o in n||(e.style[o]="");for(var o in n)e.style[o]="number"==typeof n[o]&&!1===p.test(o)?n[o]+"px":n[o]}}else if("dangerouslySetInnerHTML"===t)n&&(e.innerHTML=n.__html||"");else if("o"==t[0]&&"n"==t[1]){var a=t!==(t=t.replace(/Capture$/,""));t=t.toLowerCase().substring(2),n?r||e.addEventListener(t,_,a):e.removeEventListener(t,_,a),(e._listeners||(e._listeners={}))[t]=n}else if("list"!==t&&"type"!==t&&!i&&t in e){try{e[t]=null==n?"":n}catch(e){}null!=n&&!1!==n||"spellcheck"==t||e.removeAttribute(t)}else{var u=i&&t!==(t=t.replace(/^xlink:?/,""));null==n||!1===n?u?e.removeAttributeNS("http://www.w3.org/1999/xlink",t.toLowerCase()):e.removeAttribute(t):"function"!=typeof n&&(u?e.setAttributeNS("http://www.w3.org/1999/xlink",t.toLowerCase(),n):e.setAttribute(t,n))}else e.className=n||""}function _(e){return this._listeners[e.type](i.event&&i.event(e)||e)}var x=[],g=0,C=!1,S=!1;function T(){for(var e;e=x.shift();)i.afterMount&&i.afterMount(e),e.componentDidMount&&e.componentDidMount()}function L(e,t,r,n,i,o){g++||(C=null!=i&&void 0!==i.ownerSVGElement,S=null!=e&&!("__preactattr_"in e));var a=V(e,t,r,n,o);return i&&a.parentNode!==i&&i.appendChild(a),--g||(S=!1,o||T()),a}function V(e,t,r,n,i){var o=e,a=C;if(null!=t&&"boolean"!=typeof t||(t=""),"string"==typeof t||"number"==typeof t)return e&&void 0!==e.splitText&&e.parentNode&&(!e._component||i)?e.nodeValue!=t&&(e.nodeValue=t):(o=document.createTextNode(t),e&&(e.parentNode&&e.parentNode.replaceChild(o,e),w(e,!0))),o.__preactattr_=!0,o;var u,s,l=t.nodeName;if("function"==typeof l)return function(e,t,r,n){var i=e&&e._component,o=i,a=e,u=i&&e._componentConstructor===t.nodeName,s=u,l=h(t);for(;i&&!s&&(i=i._parentComponent);)s=i.constructor===t.nodeName;i&&s&&(!n||i._component)?(O(i,l,3,r,n),e=i.base):(o&&!u&&(k(o),e=a=null),i=j(t.nodeName,l,r),e&&!i.nextBase&&(i.nextBase=e,a=null),O(i,l,1,r,n),e=i.base,a&&e!==a&&(a._component=null,w(a,!1)));return e}(e,t,r,n);if(C="svg"===l||"foreignObject"!==l&&C,l=String(l),(!e||!m(e,l))&&(u=l,(s=C?document.createElementNS("http://www.w3.org/2000/svg",u):document.createElement(u)).normalizedNodeName=u,o=s,e)){for(;e.firstChild;)o.appendChild(e.firstChild);e.parentNode&&e.parentNode.replaceChild(o,e),w(e,!0)}var c=o.firstChild,p=o.__preactattr_,d=t.children;if(null==p){p=o.__preactattr_={};for(var f=o.attributes,v=f.length;v--;)p[f[v].name]=f[v].value}return!S&&d&&1===d.length&&"string"==typeof d[0]&&null!=c&&void 0!==c.splitText&&null==c.nextSibling?c.nodeValue!=d[0]&&(c.nodeValue=d[0]):(d&&d.length||null!=c)&&function(e,t,r,n,i){var o,a,u,s,l,c=e.childNodes,p=[],d={},f=0,v=0,h=c.length,b=0,_=t?t.length:0;if(0!==h)for(var x=0;x<h;x++){var g=c[x],C=g.__preactattr_,S=_&&C?g._component?g._component.__key:C.key:null;null!=S?(f++,d[S]=g):(C||(void 0!==g.splitText?!i||g.nodeValue.trim():i))&&(p[b++]=g)}if(0!==_)for(var x=0;x<_;x++){s=t[x],l=null;var S=s.key;if(null!=S)f&&void 0!==d[S]&&(l=d[S],d[S]=void 0,f--);else if(v<b)for(o=v;o<b;o++)if(void 0!==p[o]&&(T=a=p[o],D=i,"string"==typeof(L=s)||"number"==typeof L?void 0!==T.splitText:"string"==typeof L.nodeName?!T._componentConstructor&&m(T,L.nodeName):D||T._componentConstructor===L.nodeName)){l=a,p[o]=void 0,o===b-1&&b--,o===v&&v++;break}l=V(l,s,r,n),u=c[x],l&&l!==e&&l!==u&&(null==u?e.appendChild(l):l===u.nextSibling?y(u):e.insertBefore(l,u))}var T,L,D;if(f)for(var x in d)void 0!==d[x]&&w(d[x],!1);for(;v<=b;)void 0!==(l=p[b--])&&w(l,!1)}(o,d,r,n,S||null!=p.dangerouslySetInnerHTML),function(e,t,r){var n;for(n in r)t&&null!=t[n]||null==r[n]||b(e,n,r[n],r[n]=void 0,C);for(n in t)"children"===n||"innerHTML"===n||n in r&&t[n]===("value"===n||"checked"===n?e[n]:r[n])||b(e,n,r[n],r[n]=t[n],C)}(o,t.attributes,p),C=a,o}function w(e,t){var r=e._component;r?k(r):(null!=e.__preactattr_&&l(e.__preactattr_.ref,null),!1!==t&&null!=e.__preactattr_||y(e),D(e))}function D(e){for(e=e.lastChild;e;){var t=e.previousSibling;w(e,!0),e=t}}var E=[];function j(e,t,r){var n,i=E.length;for(e.prototype&&e.prototype.render?(n=new e(t,r),A.call(n,t,r)):((n=new A(t,r)).constructor=e,n.render=N);i--;)if(E[i].constructor===e)return n.nextBase=E[i].nextBase,E.splice(i,1),n;return n}function N(e,t,r){return this.constructor(e,r)}function O(e,t,r,n,o){e._disable||(e._disable=!0,e.__ref=t.ref,e.__key=t.key,delete t.ref,delete t.key,void 0===e.constructor.getDerivedStateFromProps&&(!e.base||o?e.componentWillMount&&e.componentWillMount():e.componentWillReceiveProps&&e.componentWillReceiveProps(t,n)),n&&n!==e.context&&(e.prevContext||(e.prevContext=e.context),e.context=n),e.prevProps||(e.prevProps=e.props),e.props=t,e._disable=!1,0!==r&&(1!==r&&!1===i.syncComponentUpdates&&e.base?f(e):P(e,1,o)),l(e.__ref,e))}function P(e,t,r,n){if(!e._disable){var o,a,u,l=e.props,c=e.state,p=e.context,d=e.prevProps||l,f=e.prevState||c,v=e.prevContext||p,m=e.base,y=e.nextBase,b=m||y,_=e._component,C=!1,S=v;if(e.constructor.getDerivedStateFromProps&&(c=s(s({},c),e.constructor.getDerivedStateFromProps(l,c)),e.state=c),m&&(e.props=d,e.state=f,e.context=v,2!==t&&e.shouldComponentUpdate&&!1===e.shouldComponentUpdate(l,c,p)?C=!0:e.componentWillUpdate&&e.componentWillUpdate(l,c,p),e.props=l,e.state=c,e.context=p),e.prevProps=e.prevState=e.prevContext=e.nextBase=null,e._dirty=!1,!C){o=e.render(l,c,p),e.getChildContext&&(p=s(s({},p),e.getChildContext())),m&&e.getSnapshotBeforeUpdate&&(S=e.getSnapshotBeforeUpdate(d,f));var V,D,E=o&&o.nodeName;if("function"==typeof E){var N=h(o);(a=_)&&a.constructor===E&&N.key==a.__key?O(a,N,1,p,!1):(V=a,e._component=a=j(E,N,p),a.nextBase=a.nextBase||y,a._parentComponent=e,O(a,N,0,p,!1),P(a,1,r,!0)),D=a.base}else u=b,(V=_)&&(u=e._component=null),(b||1===t)&&(u&&(u._component=null),D=L(u,o,p,r||!m,b&&b.parentNode,!0));if(b&&D!==b&&a!==_){var A=b.parentNode;A&&D!==A&&(A.replaceChild(D,b),V||(b._component=null,w(b,!1)))}if(V&&k(V),e.base=D,D&&!n){for(var q=e,B=e;B=B._parentComponent;)(q=B).base=D;D._component=q,D._componentConstructor=q.constructor}}for(!m||r?x.push(e):C||(e.componentDidUpdate&&e.componentDidUpdate(d,f,S),i.afterUpdate&&i.afterUpdate(e));e._renderCallbacks.length;)e._renderCallbacks.pop().call(e);g||n||T()}}function k(e){i.beforeUnmount&&i.beforeUnmount(e);var t=e.base;e._disable=!0,e.componentWillUnmount&&e.componentWillUnmount(),e.base=null;var r=e._component;r?k(r):t&&(null!=t.__preactattr_&&l(t.__preactattr_.ref,null),e.nextBase=t,y(t),E.push(e),D(t)),l(e.__ref,null)}function A(e,t){this._dirty=!0,this.context=t,this.props=e,this.state=this.state||{},this._renderCallbacks=[]}function q(e,t,r){return L(r,e,{},!1,t,!1)}s(A.prototype,{setState:function(e,t){this.prevState||(this.prevState=this.state),this.state=s(s({},this.state),"function"==typeof e?e(this.state,this.props):e),t&&this._renderCallbacks.push(t),f(this)},forceUpdate:function(e){e&&this._renderCallbacks.push(e),P(this,2)},render:function(){}});r(0);var B=0,M=document.head.appendChild(document.createElement("style")).sheet;function U(e,t){var r="p"+B++,n=t+r;return e.forEach(function(e){if(/^@/.test(e)){var t=e.indexOf("{")+1;e=e.slice(0,t)+n+e.slice(t)}else e=n+e;M.insertRule(e,M.cssRules.length)}),r}function z(e,t){return t+"{"+e+"}"}function F(e,t){var r=[""];for(var n in t=t||0,e){var i=e[n];n=n.replace(/[A-Z]/g,"-$&").toLowerCase(),i.sub||Array.isArray(i)?(i=Array.isArray(i)?i:[i]).forEach(function(e){return r[0]+=n+":"+e+";"}):(n=n.replace(/&/g,""),r.push(z(F(i,!/^@/.test(n)).join(""),n)))}return t||(r[0]=z(r[0],"")),r}var I=function(e,t){var r={};return(t=t||{}).returnObject?{style:n,css:i}:n;function n(t){return function(r){return function(n,o){o=(n=n||{}).children||o;var a="function"==typeof r?r(n):r;return n.class=[i(a),n.class].filter(Boolean).join(" "),e(t,n,o)}}}function i(e){var t=F(e),n=t.join("");return r[n]||(r[n]=U(t,"."))}};var R=function(e){window.postMessage(JSON.stringify(e))},W="SEND_INITIAL_DATA",H="SEND_HIGHLIGHTED_VERSES",Q="NAVIGATE_TO_BIBLE_VERSE_DETAIL",G="TOGGLE_SELECTED_VERSE";function $(e){return($="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function J(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n)}}function Z(e){return(Z=Object.setPrototypeOf?Object.getPrototypeOf:function(e){return e.__proto__||Object.getPrototypeOf(e)})(e)}function K(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}function X(e,t){return(X=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e})(e,t)}function Y(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}var ee=I(u),te=ee("span")({fontSize:"20px",lineHeight:"34px"}),re=ee("span")({fontSize:"28px",padding:"0 10px"}),ne=ee("span")(function(e){return{fontFamily:"Literata Book",background:e.isFocused?"rgba(0,0,0,0.2)":"transparent","-webkit-touch-callout":"none",padding:"4px",borderBottom:e.isSelected?"1px dashed blue":"none"}}),ie=function(e){function t(){var e,r,n,i;!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,t);for(var o=arguments.length,a=new Array(o),u=0;u<o;u++)a[u]=arguments[u];return n=this,i=(e=Z(t)).call.apply(e,[this].concat(a)),r=!i||"object"!==$(i)&&"function"!=typeof i?K(n):i,Y(K(r),"state",{focused:!1}),Y(K(r),"navigateToBibleVerseDetail",function(){R({type:Q,payload:r.props.verset})}),Y(K(r),"toggleSelectVerse",function(){var e=r.props.verse,t=e.Livre,n=e.Chapitre,i=e.Verset;R({type:G,payload:"".concat(t,"-").concat(n,"-").concat(i)})}),Y(K(r),"onTouchStart",function(){r.setState({isFocused:!0})}),Y(K(r),"onTouchEnd",function(){r.setState({isFocused:!1})}),r}var r,n,i;return function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),t&&X(e,t)}(t,A),r=t,(n=[{key:"render",value:function(e,t){var r=e.verse,n=e.isSelected,i=t.isFocused;return u(ne,{isFocused:i,isSelected:n,onClick:this.toggleSelectVerse,onTouchStart:this.onTouchStart,onTouchEnd:this.onTouchEnd},u(re,null,r.Verset),u(te,null,r.Texte))}}])&&J(r.prototype,n),i&&J(r,i),t}();function oe(e){return(oe="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function ae(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n)}}function ue(e){return(ue=Object.setPrototypeOf?Object.getPrototypeOf:function(e){return e.__proto__||Object.getPrototypeOf(e)})(e)}function se(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}function le(e,t){return(le=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e})(e,t)}function ce(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}var pe=I(u)("div")({maxWidth:"320px",width:"100%",margin:"0 auto",textAlign:"justify"}),de=function(e){function t(){var e,r,n,i;!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,t);for(var o=arguments.length,a=new Array(o),u=0;u<o;u++)a[u]=arguments[u];return n=this,i=(e=ue(t)).call.apply(e,[this].concat(a)),r=!i||"object"!==oe(i)&&"function"!=typeof i?se(n):i,ce(se(r),"state",{verses:[],highlightedVerses:{}}),ce(se(r),"receiveDataFromApp",function(){var e=se(r);document.addEventListener("message",function(t){var r=JSON.parse(t.data);switch(r.type){case W:e.setState({verses:r.arrayVerses,highlightedVerses:r.highlightedVerses});break;case H:e.setState({highlightedVerses:r.highlightedVerses})}})}),r}var r,n,i;return function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),t&&le(e,t)}(t,A),r=t,(n=[{key:"componentDidMount",value:function(){this.setState({verses:this.props.verses}),this.receiveDataFromApp(),window.oncontextmenu=function(e){return e.preventDefault(),e.stopPropagation(),!1}}},{key:"render",value:function(e,t){return t.verses.length?u(pe,null,t.verses.map(function(e){var r=e.Livre,n=e.Chapitre,i=e.Verset,o=!!t.highlightedVerses["".concat(r,"-").concat(n,"-").concat(i)];return u(ie,{verse:e,isSelected:o})})):null}}])&&ae(r.prototype,n),i&&ae(r,i),t}();q(u(de,{verses:[{Verset:"1",Texte:"Au commencement, Dieu créa les cieux et la terre.",Livre:1,Chapitre:1},{Verset:"2",Texte:"La terre était informe et vide: il y avait des ténèbres à la surface de l’abîme, et l’esprit de Dieu se mouvait au-dessus des eaux.",Livre:1,Chapitre:1},{Verset:"3",Texte:"Dieu dit: Que la lumière soit! Et la lumière fut.",Livre:1,Chapitre:1},{Verset:"4",Texte:"Dieu vit que la lumière était bonne; et Dieu sépara la lumière d’avec les ténèbres.",Livre:1,Chapitre:1},{Verset:"5",Texte:"Dieu appela la lumière jour, et il appela les ténèbres nuit. Ainsi, il y eut un soir, et il y eut un matin: ce fut le premier jour.",Livre:1,Chapitre:1},{Verset:"6",Texte:"Dieu dit: Qu’il y ait une étendue entre les eaux, et qu’elle sépare les eaux d’avec les eaux.",Livre:1,Chapitre:1},{Verset:"7",Texte:"Et Dieu fit l’étendue, et il sépara les eaux qui sont au-dessous de l’étendue d’avec les eaux qui sont au-dessus de l’étendue. Et cela fut ainsi.",Livre:1,Chapitre:1},{Verset:"8",Texte:"Dieu appela l’étendue ciel. Ainsi, il y eut un soir, et il y eut un matin: ce fut le second jour.",Livre:1,Chapitre:1},{Verset:"9",Texte:"Dieu dit: Que les eaux qui sont au-dessous du ciel se rassemblent en un seul lieu, et que le sec paraisse. Et cela fut ainsi.",Livre:1,Chapitre:1},{Verset:"10",Texte:"Dieu appela le sec terre, et il appela l’amas des eaux mers. Dieu vit que cela était bon.",Livre:1,Chapitre:1},{Verset:"11",Texte:"Puis Dieu dit: Que la terre produise de la verdure, de l’herbe portant de la semence, des arbres fruitiers donnant du fruit selon leur espèce et ayant en eux leur semence sur la terre. Et cela fut ainsi.",Livre:1,Chapitre:1},{Verset:"12",Texte:"La terre produisit de la verdure, de l’herbe portant de la semence selon son espèce, et des arbres donnant du fruit et ayant en eux leur semence selon leur espèce. Dieu vit que cela était bon.",Livre:1,Chapitre:1},{Verset:"13",Texte:"Ainsi, il y eut un soir, et il y eut un matin: ce fut le troisième jour.",Livre:1,Chapitre:1},{Verset:"14",Texte:"Dieu dit: Qu’il y ait des luminaires dans l’étendue du ciel, pour séparer le jour d’avec la nuit; que ce soient des signes pour marquer les époques, les jours et les années;",Livre:1,Chapitre:1},{Verset:"15",Texte:"et qu’ils servent de luminaires dans l’étendue du ciel, pour éclairer la terre. Et cela fut ainsi.",Livre:1,Chapitre:1},{Verset:"16",Texte:"Dieu fit les deux grands luminaires, le plus grand luminaire pour présider au jour, et le plus petit luminaire pour présider à la nuit; il fit aussi les étoiles.",Livre:1,Chapitre:1},{Verset:"17",Texte:"Dieu les plaça dans l’étendue du ciel, pour éclairer la terre,",Livre:1,Chapitre:1},{Verset:"18",Texte:"pour présider au jour et à la nuit, et pour séparer la lumière d’avec les ténèbres. Dieu vit que cela était bon.",Livre:1,Chapitre:1},{Verset:"19",Texte:"Ainsi, il y eut un soir, et il y eut un matin: ce fut le quatrième jour.",Livre:1,Chapitre:1},{Verset:"20",Texte:"Dieu dit: Que les eaux produisent en abondance des animaux vivants, et que des oiseaux volent sur la terre vers l’étendue du ciel.",Livre:1,Chapitre:1},{Verset:"21",Texte:"Dieu créa les grands poissons et tous les animaux vivants qui se meuvent, et que les eaux produisirent en abondance selon leur espèce; il créa aussi tout oiseau ailé selon son espèce. Dieu vit que cela était bon.",Livre:1,Chapitre:1},{Verset:"22",Texte:"Dieu les bénit, en disant: Soyez féconds, multipliez, et remplissez les eaux des mers; et que les oiseaux multiplient sur la terre.",Livre:1,Chapitre:1},{Verset:"23",Texte:"Ainsi, il y eut un soir, et il y eut un matin: ce fut le cinquième jour.",Livre:1,Chapitre:1},{Verset:"24",Texte:"Dieu dit: Que la terre produise des animaux vivants selon leur espèce, du bétail, des reptiles et des animaux terrestres, selon leur espèce. Et cela fut ainsi.",Livre:1,Chapitre:1},{Verset:"25",Texte:"Dieu fit les animaux de la terre selon leur espèce, le bétail selon son espèce, et tous les reptiles de la terre selon leur espèce. Dieu vit que cela était bon.",Livre:1,Chapitre:1},{Verset:"26",Texte:"Puis Dieu dit: Faisons l’homme à notre image, selon notre ressemblance, et qu’il domine sur les poissons de la mer, sur les oiseaux du ciel, sur le bétail, sur toute la terre, et sur tous les reptiles qui rampent sur la terre.",Livre:1,Chapitre:1},{Verset:"27",Texte:"Dieu créa l’homme à son image, il le créa à l’image de Dieu, il créa l’homme et la femme.",Livre:1,Chapitre:1},{Verset:"28",Texte:"Dieu les bénit, et Dieu leur dit: Soyez féconds, multipliez, remplissez la terre, et l’assujettissez; et dominez sur les poissons de la mer, sur les oiseaux du ciel, et sur tout animal qui se meut sur la terre.",Livre:1,Chapitre:1},{Verset:"29",Texte:"Et Dieu dit: Voici, je vous donne toute herbe portant de la semence et qui est à la surface de toute la terre, et tout arbre ayant en lui du fruit d’arbre et portant de la semence: ce sera votre nourriture.",Livre:1,Chapitre:1},{Verset:"30",Texte:"Et à tout animal de la terre, à tout oiseau du ciel, et à tout ce qui se meut sur la terre, ayant en soi un souffle de vie, je donne toute herbe verte pour nourriture. Et cela fut ainsi.",Livre:1,Chapitre:1},{Verset:"31",Texte:"Dieu vit tout ce qu’il avait fait et voici, cela était très bon. Ainsi, il y eut un soir, et il y eut un matin: ce fut le sixième jour.",Livre:1,Chapitre:1}]}),document.getElementById("app"))}]);