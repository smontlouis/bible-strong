export default "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1\"></head><body data-swipe-threshold=\"100\"><script type=\"module\">var e,t,n,_,r,o,l,i,u,c,s,a={},f=[],p=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,h=Array.isArray;function d(e,t){for(var n in t)e[n]=t[n];return e}function v(e){e&&e.parentNode&&e.parentNode.removeChild(e)}function m(t,n,_){var r,o,l,i={};for(l in n)\"key\"==l?r=n[l]:\"ref\"==l?o=n[l]:i[l]=n[l];if(arguments.length>2&&(i.children=arguments.length>3?e.call(arguments,2):_),\"function\"==typeof t&&null!=t.defaultProps)for(l in t.defaultProps)void 0===i[l]&&(i[l]=t.defaultProps[l]);return y(t,i,r,o,null)}function y(e,_,r,o,l){var i={type:e,props:_,key:r,ref:o,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:null==l?++n:l,__i:-1,__u:0};return null==l&&null!=t.vnode&&t.vnode(i),i}function g(e){return e.children}function b(e,t){this.props=e,this.context=t}function k(e,t){if(null==t)return e.__?k(e.__,e.__i+1):null;for(var n;t<e.__k.length;t++)if(null!=(n=e.__k[t])&&null!=n.__e)return n.__e;return\"function\"==typeof e.type?k(e):null}function w(e){var t,n;if(null!=(e=e.__)&&null!=e.__c){for(e.__e=e.__c.base=null,t=0;t<e.__k.length;t++)if(null!=(n=e.__k[t])&&null!=n.__e){e.__e=e.__c.base=n.__e;break}return w(e)}}function S(e){(!e.__d&&(e.__d=!0)&&_.push(e)&&!C.__r++||r!==t.debounceRendering)&&((r=t.debounceRendering)||o)(C)}function C(){var e,n,r,o,i,u,c,s;for(_.sort(l);e=_.shift();)e.__d&&(n=_.length,o=void 0,u=(i=(r=e).__v).__e,c=[],s=[],r.__P&&((o=d({},i)).__v=i.__v+1,t.vnode&&t.vnode(o),T(r.__P,o,i,r.__n,r.__P.namespaceURI,32&i.__u?[u]:null,c,null==u?k(i):u,!!(32&i.__u),s),o.__v=i.__v,o.__.__k[o.__i]=o,O(c,o,s),o.__e!=u&&w(o)),_.length>n&&_.sort(l));C.__r=0}function P(e,t,n,_,r,o,l,i,u,c,s){var p,d,v,m,b,w,S=_&&_.__k||f,C=t.length;for(u=function(e,t,n,_,r){var o,l,i,u,c,s=n.length,a=s,f=0;for(e.__k=new Array(r),o=0;o<r;o++)null!=(l=t[o])&&\"boolean\"!=typeof l&&\"function\"!=typeof l?(u=o+f,(l=e.__k[o]=\"string\"==typeof l||\"number\"==typeof l||\"bigint\"==typeof l||l.constructor==String?y(null,l,null,null,null):h(l)?y(g,{children:l},null,null,null):void 0===l.constructor&&l.__b>0?y(l.type,l.props,l.key,l.ref?l.ref:null,l.__v):l).__=e,l.__b=e.__b+1,i=null,-1!==(c=l.__i=N(l,n,u,a))&&(a--,(i=n[c])&&(i.__u|=2)),null==i||null===i.__v?(-1==c&&f--,\"function\"!=typeof l.type&&(l.__u|=4)):c!=u&&(c==u-1?f--:c==u+1?f++:(c>u?f--:f++,l.__u|=4))):e.__k[o]=null;if(a)for(o=0;o<s;o++)null!=(i=n[o])&&0==(2&i.__u)&&(i.__e==_&&(_=k(i)),F(i,i));return _}(n,t,S,u,C),p=0;p<C;p++)null!=(v=n.__k[p])&&(d=-1===v.__i?a:S[v.__i]||a,v.__i=p,w=T(e,v,d,r,o,l,i,u,c,s),m=v.__e,v.ref&&d.ref!=v.ref&&(d.ref&&M(d.ref,null,v),s.push(v.ref,v.__c||m,v)),null==b&&null!=m&&(b=m),4&v.__u||d.__k===v.__k?u=x(v,u,e):\"function\"==typeof v.type&&void 0!==w?u=w:m&&(u=m.nextSibling),v.__u&=-7);return n.__e=b,u}function x(e,t,n){var _,r;if(\"function\"==typeof e.type){for(_=e.__k,r=0;_&&r<_.length;r++)_[r]&&(_[r].__=e,t=x(_[r],t,n));return t}e.__e!=t&&(t&&e.type&&!n.contains(t)&&(t=k(e)),n.insertBefore(e.__e,t||null),t=e.__e);do{t=t&&t.nextSibling}while(null!=t&&8==t.nodeType);return t}function H(e,t){return t=t||[],null==e||\"boolean\"==typeof e||(h(e)?e.some((function(e){H(e,t)})):t.push(e)),t}function N(e,t,n,_){var r,o,l=e.key,i=e.type,u=t[n];if(null===u||u&&l==u.key&&i===u.type&&0==(2&u.__u))return n;if(_>(null!=u&&0==(2&u.__u)?1:0))for(r=n-1,o=n+1;r>=0||o<t.length;){if(r>=0){if((u=t[r])&&0==(2&u.__u)&&l==u.key&&i===u.type)return r;r--}if(o<t.length){if((u=t[o])&&0==(2&u.__u)&&l==u.key&&i===u.type)return o;o++}}return-1}function E(e,t,n){\"-\"==t[0]?e.setProperty(t,null==n?\"\":n):e[t]=null==n?\"\":\"number\"!=typeof n||p.test(t)?n:n+\"px\"}function U(e,t,n,_,r){var o;e:if(\"style\"==t)if(\"string\"==typeof n)e.style.cssText=n;else{if(\"string\"==typeof _&&(e.style.cssText=_=\"\"),_)for(t in _)n&&t in n||E(e.style,t,\"\");if(n)for(t in n)_&&n[t]===_[t]||E(e.style,t,n[t])}else if(\"o\"==t[0]&&\"n\"==t[1])o=t!=(t=t.replace(i,\"$1\")),t=t.toLowerCase()in e||\"onFocusOut\"==t||\"onFocusIn\"==t?t.toLowerCase().slice(2):t.slice(2),e.l||(e.l={}),e.l[t+o]=n,n?_?n.u=_.u:(n.u=u,e.addEventListener(t,o?s:c,o)):e.removeEventListener(t,o?s:c,o);else{if(\"http://www.w3.org/2000/svg\"==r)t=t.replace(/xlink(H|:h)/,\"h\").replace(/sName$/,\"s\");else if(\"width\"!=t&&\"height\"!=t&&\"href\"!=t&&\"list\"!=t&&\"form\"!=t&&\"tabIndex\"!=t&&\"download\"!=t&&\"rowSpan\"!=t&&\"colSpan\"!=t&&\"role\"!=t&&\"popover\"!=t&&t in e)try{e[t]=null==n?\"\":n;break e}catch(e){}\"function\"==typeof n||(null==n||!1===n&&\"-\"!=t[4]?e.removeAttribute(t):e.setAttribute(t,\"popover\"==t&&1==n?\"\":n))}}function A(e){return function(n){if(this.l){var _=this.l[n.type+e];if(null==n.t)n.t=u++;else if(n.t<_.u)return;return _(t.event?t.event(n):n)}}}function T(n,_,r,o,l,i,u,c,s,f){var p,m,y,w,S,C,x,H,N,E,A,T,O,M,F,D,L,R=_.type;if(void 0!==_.constructor)return null;128&r.__u&&(s=!!(32&r.__u),i=[c=_.__e=r.__e]),(p=t.__b)&&p(_);e:if(\"function\"==typeof R)try{if(H=_.props,N=\"prototype\"in R&&R.prototype.render,E=(p=R.contextType)&&o[p.__c],A=p?E?E.props.value:p.__:o,r.__c?x=(m=_.__c=r.__c).__=m.__E:(N?_.__c=m=new R(H,A):(_.__c=m=new b(H,A),m.constructor=R,m.render=V),E&&E.sub(m),m.props=H,m.state||(m.state={}),m.context=A,m.__n=o,y=m.__d=!0,m.__h=[],m._sb=[]),N&&null==m.__s&&(m.__s=m.state),N&&null!=R.getDerivedStateFromProps&&(m.__s==m.state&&(m.__s=d({},m.__s)),d(m.__s,R.getDerivedStateFromProps(H,m.__s))),w=m.props,S=m.state,m.__v=_,y)N&&null==R.getDerivedStateFromProps&&null!=m.componentWillMount&&m.componentWillMount(),N&&null!=m.componentDidMount&&m.__h.push(m.componentDidMount);else{if(N&&null==R.getDerivedStateFromProps&&H!==w&&null!=m.componentWillReceiveProps&&m.componentWillReceiveProps(H,A),!m.__e&&(null!=m.shouldComponentUpdate&&!1===m.shouldComponentUpdate(H,m.__s,A)||_.__v==r.__v)){for(_.__v!=r.__v&&(m.props=H,m.state=m.__s,m.__d=!1),_.__e=r.__e,_.__k=r.__k,_.__k.some((function(e){e&&(e.__=_)})),T=0;T<m._sb.length;T++)m.__h.push(m._sb[T]);m._sb=[],m.__h.length&&u.push(m);break e}null!=m.componentWillUpdate&&m.componentWillUpdate(H,m.__s,A),N&&null!=m.componentDidUpdate&&m.__h.push((function(){m.componentDidUpdate(w,S,C)}))}if(m.context=A,m.props=H,m.__P=n,m.__e=!1,O=t.__r,M=0,N){for(m.state=m.__s,m.__d=!1,O&&O(_),p=m.render(m.props,m.state,m.context),F=0;F<m._sb.length;F++)m.__h.push(m._sb[F]);m._sb=[]}else do{m.__d=!1,O&&O(_),p=m.render(m.props,m.state,m.context),m.state=m.__s}while(m.__d&&++M<25);m.state=m.__s,null!=m.getChildContext&&(o=d(d({},o),m.getChildContext())),N&&!y&&null!=m.getSnapshotBeforeUpdate&&(C=m.getSnapshotBeforeUpdate(w,S)),c=P(n,h(D=null!=p&&p.type===g&&null==p.key?p.props.children:p)?D:[D],_,r,o,l,i,u,c,s,f),m.base=_.__e,_.__u&=-161,m.__h.length&&u.push(m),x&&(m.__E=m.__=null)}catch(n){if(_.__v=null,s||null!=i)if(n.then){for(_.__u|=s?160:128;c&&8==c.nodeType&&c.nextSibling;)c=c.nextSibling;i[i.indexOf(c)]=null,_.__e=c}else for(L=i.length;L--;)v(i[L]);else _.__e=r.__e,_.__k=r.__k;t.__e(n,_,r)}else null==i&&_.__v==r.__v?(_.__k=r.__k,_.__e=r.__e):c=_.__e=function(n,_,r,o,l,i,u,c,s){var f,p,d,m,y,g,b,w=r.props,S=_.props,C=_.type;if(\"svg\"==C?l=\"http://www.w3.org/2000/svg\":\"math\"==C?l=\"http://www.w3.org/1998/Math/MathML\":l||(l=\"http://www.w3.org/1999/xhtml\"),null!=i)for(f=0;f<i.length;f++)if((y=i[f])&&\"setAttribute\"in y==!!C&&(C?y.localName==C:3==y.nodeType)){n=y,i[f]=null;break}if(null==n){if(null==C)return document.createTextNode(S);n=document.createElementNS(l,C,S.is&&S),c&&(t.__m&&t.__m(_,i),c=!1),i=null}if(null===C)w===S||c&&n.data===S||(n.data=S);else{if(i=i&&e.call(n.childNodes),w=r.props||a,!c&&null!=i)for(w={},f=0;f<n.attributes.length;f++)w[(y=n.attributes[f]).name]=y.value;for(f in w)if(y=w[f],\"children\"==f);else if(\"dangerouslySetInnerHTML\"==f)d=y;else if(!(f in S)){if(\"value\"==f&&\"defaultValue\"in S||\"checked\"==f&&\"defaultChecked\"in S)continue;U(n,f,null,y,l)}for(f in S)y=S[f],\"children\"==f?m=y:\"dangerouslySetInnerHTML\"==f?p=y:\"value\"==f?g=y:\"checked\"==f?b=y:c&&\"function\"!=typeof y||w[f]===y||U(n,f,y,w[f],l);if(p)c||d&&(p.__html===d.__html||p.__html===n.innerHTML)||(n.innerHTML=p.__html),_.__k=[];else if(d&&(n.innerHTML=\"\"),P(n,h(m)?m:[m],_,r,o,\"foreignObject\"==C?\"http://www.w3.org/1999/xhtml\":l,i,u,i?i[0]:r.__k&&k(r,0),c,s),null!=i)for(f=i.length;f--;)v(i[f]);c||(f=\"value\",\"progress\"==C&&null==g?n.removeAttribute(\"value\"):void 0!==g&&(g!==n[f]||\"progress\"==C&&!g||\"option\"==C&&g!==w[f])&&U(n,f,g,w[f],l),f=\"checked\",void 0!==b&&b!==n[f]&&U(n,f,b,w[f],l))}return n}(r.__e,_,r,o,l,i,u,s,f);return(p=t.diffed)&&p(_),128&_.__u?void 0:c}function O(e,n,_){for(var r=0;r<_.length;r++)M(_[r],_[++r],_[++r]);t.__c&&t.__c(n,e),e.some((function(n){try{e=n.__h,n.__h=[],e.some((function(e){e.call(n)}))}catch(e){t.__e(e,n.__v)}}))}function M(e,n,_){try{if(\"function\"==typeof e){var r=\"function\"==typeof e.__u;r&&e.__u(),r&&null==n||(e.__u=e(n))}else e.current=n}catch(e){t.__e(e,_)}}function F(e,n,_){var r,o;if(t.unmount&&t.unmount(e),(r=e.ref)&&(r.current&&r.current!==e.__e||M(r,null,n)),null!=(r=e.__c)){if(r.componentWillUnmount)try{r.componentWillUnmount()}catch(e){t.__e(e,n)}r.base=r.__P=null}if(r=e.__k)for(o=0;o<r.length;o++)r[o]&&F(r[o],n,_||\"function\"!=typeof e.type);_||v(e.__e),e.__c=e.__=e.__e=void 0}function V(e,t,n){return this.constructor(e,n)}e=f.slice,t={__e:function(e,t,n,_){for(var r,o,l;t=t.__;)if((r=t.__c)&&!r.__)try{if((o=r.constructor)&&null!=o.getDerivedStateFromError&&(r.setState(o.getDerivedStateFromError(e)),l=r.__d),null!=r.componentDidCatch&&(r.componentDidCatch(e,_||{}),l=r.__d),l)return r.__E=r}catch(t){e=t}throw e}},n=0,b.prototype.setState=function(e,t){var n;n=null!=this.__s&&this.__s!==this.state?this.__s:this.__s=d({},this.state),\"function\"==typeof e&&(e=e(d({},n),this.props)),e&&d(n,e),null!=e&&this.__v&&(t&&this._sb.push(t),S(this))},b.prototype.forceUpdate=function(e){this.__v&&(this.__e=!0,e&&this.__h.push(e),S(this))},b.prototype.render=g,_=[],o=\"function\"==typeof Promise?Promise.prototype.then.bind(Promise.resolve()):setTimeout,l=function(e,t){return e.__v.__b-t.__v.__b},C.__r=0,i=/(PointerCapture)$|Capture$/i,u=0,c=A(!1),s=A(!0);var D=function(e,t,n,_){var r;t[0]=0;for(var o=1;o<t.length;o++){var l=t[o++],i=t[o]?(t[0]|=l?1:2,n[t[o++]]):t[++o];3===l?_[0]=i:4===l?_[1]=Object.assign(_[1]||{},i):5===l?(_[1]=_[1]||{})[t[++o]]=i:6===l?_[1][t[++o]]+=i+\"\":l?(r=e.apply(i,D(e,i,n,[\"\",null])),_.push(r),i[0]?t[0]|=2:(t[o-2]=0,t[o]=r)):_.push(i)}return _},L=new Map;var R=function(e){var t=L.get(this);return t||(t=new Map,L.set(this,t)),(t=D(this,t.get(e)||(t.set(e,t=function(e){for(var t,n,_=1,r=\"\",o=\"\",l=[0],i=function(e){1===_&&(e||(r=r.replace(/^\\s*\\n\\s*|\\s*\\n\\s*$/g,\"\")))?l.push(0,e,r):3===_&&(e||r)?(l.push(3,e,r),_=2):2===_&&\"...\"===r&&e?l.push(4,e,0):2===_&&r&&!e?l.push(5,0,!0,r):_>=5&&((r||!e&&5===_)&&(l.push(_,0,r,n),_=6),e&&(l.push(_,e,0,n),_=6)),r=\"\"},u=0;u<e.length;u++){u&&(1===_&&i(),i(u));for(var c=0;c<e[u].length;c++)t=e[u][c],1===_?\"<\"===t?(i(),l=[l],_=3):r+=t:4===_?\"--\"===r&&\">\"===t?(_=1,r=\"\"):r=t+r[0]:o?t===o?o=\"\":r+=t:'\"'===t||\"'\"===t?o=t:\">\"===t?(i(),_=1):_&&(\"=\"===t?(_=5,n=r,r=\"\"):\"/\"===t&&(_<5||\">\"===e[u][c+1])?(i(),3===_&&(l=l[0]),_=l,(l=l[0]).push(2,0,_),_=0):\" \"===t||\"\\t\"===t||\"\\n\"===t||\"\\r\"===t?(i(),_=2):r+=t),3===_&&\"!--\"===r&&(_=4,l=l[0])}return i(),l}(e)),t),arguments,[])).length>1?t:t[0]}.bind(m);let W={data:\"\"},j=e=>\"object\"==typeof window?((e?e.querySelector(\"#_goober\"):window._goober)||Object.assign((e||document.head).appendChild(document.createElement(\"style\")),{innerHTML:\" \",id:\"_goober\"})).firstChild:e||W,$=/(?:([\\u0080-\\uFFFF\\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\\s*)/g,I=/\\/\\*[^]*?\\*\\/|  +/g,q=/\\n+/g,B=(e,t)=>{let n=\"\",_=\"\",r=\"\";for(let o in e){let l=e[o];\"@\"==o[0]?\"i\"==o[1]?n=o+\" \"+l+\";\":_+=\"f\"==o[1]?B(l,o):o+\"{\"+B(l,\"k\"==o[1]?\"\":t)+\"}\":\"object\"==typeof l?_+=B(l,t?t.replace(/([^,])+/g,(e=>o.replace(/([^,]*:\\S+\\([^)]*\\))|([^,])+/g,(t=>/&/.test(t)?t.replace(/&/g,e):e?e+\" \"+t:t)))):o):null!=l&&(o=/^--/.test(o)?o:o.replace(/[A-Z]/g,\"-$&\").toLowerCase(),r+=B.p?B.p(o,l):o+\":\"+l+\";\")}return n+(t&&r?t+\"{\"+r+\"}\":r)+_},z={},Z=e=>{if(\"object\"==typeof e){let t=\"\";for(let n in e)t+=n+Z(e[n]);return t}return e},G=(e,t,n,_,r)=>{let o=Z(e),l=z[o]||(z[o]=(e=>{let t=0,n=11;for(;t<e.length;)n=101*n+e.charCodeAt(t++)>>>0;return\"go\"+n})(o));if(!z[l]){let t=o!==e?e:(e=>{let t,n,_=[{}];for(;t=$.exec(e.replace(I,\"\"));)t[4]?_.shift():t[3]?(n=t[3].replace(q,\" \").trim(),_.unshift(_[0][n]=_[0][n]||{})):_[0][t[1]]=t[2].replace(q,\" \").trim();return _[0]})(e);z[l]=B(r?{[\"@keyframes \"+l]:t}:t,n?\"\":\".\"+l)}let i=n&&z.g?z.g:null;return n&&(z.g=z[l]),((e,t,n,_)=>{_?t.data=t.data.replace(_,e):-1===t.data.indexOf(e)&&(t.data=n?e+t.data:t.data+e)})(z[l],t,_,i),l},J=(e,t,n)=>e.reduce(((e,_,r)=>{let o=t[r];if(o&&o.call){let e=o(n),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;o=t?\".\"+t:e&&\"object\"==typeof e?e.props?\"\":B(e,\"\"):!1===e?\"\":e}return e+_+(null==o?\"\":o)}),\"\");function K(e){let t=this||{},n=e.call?e(t.p):e;return G(n.unshift?n.raw?J(n,[].slice.call(arguments,1),t.p):n.reduce(((e,n)=>Object.assign(e,n&&n.call?n(t.p):n)),{}):n,j(t.target),t.g,t.o,t.k)}K.bind({g:1}),K.bind({k:1});var Q,X,Y,ee,te=0,ne=[],_e=t,re=_e.__b,oe=_e.__r,le=_e.diffed,ie=_e.__c,ue=_e.unmount,ce=_e.__;function se(e,t){_e.__h&&_e.__h(X,e,te||t),te=0;var n=X.__H||(X.__H={__:[],__h:[]});return e>=n.__.length&&n.__.push({}),n.__[e]}function ae(e){return te=1,function(e,t,n){var _=se(Q++,2);if(_.t=e,!_.__c&&(_.__=[n?n(t):me(void 0,t),function(e){var t=_.__N?_.__N[0]:_.__[0],n=_.t(t,e);t!==n&&(_.__N=[n,_.__[1]],_.__c.setState({}))}],_.__c=X,!X.u)){var r=function(e,t,n){if(!_.__c.__H)return!0;var r=_.__c.__H.__.filter((function(e){return!!e.__c}));if(r.every((function(e){return!e.__N})))return!o||o.call(this,e,t,n);var l=_.__c.props!==e;return r.forEach((function(e){if(e.__N){var t=e.__[0];e.__=e.__N,e.__N=void 0,t!==e.__[0]&&(l=!0)}})),o&&o.call(this,e,t,n)||l};X.u=!0;var o=X.shouldComponentUpdate,l=X.componentWillUpdate;X.componentWillUpdate=function(e,t,n){if(this.__e){var _=o;o=void 0,r(e,t,n),o=_}l&&l.call(this,e,t,n)},X.shouldComponentUpdate=r}return _.__N||_.__}(me,e)}function fe(){for(var e;e=ne.shift();)if(e.__P&&e.__H)try{e.__H.__h.forEach(de),e.__H.__h.forEach(ve),e.__H.__h=[]}catch(Q){e.__H.__h=[],_e.__e(Q,e.__v)}}_e.__b=function(e){X=null,re&&re(e)},_e.__=function(e,t){e&&t.__k&&t.__k.__m&&(e.__m=t.__k.__m),ce&&ce(e,t)},_e.__r=function(e){oe&&oe(e),Q=0;var t=(X=e.__c).__H;t&&(Y===X?(t.__h=[],X.__h=[],t.__.forEach((function(e){e.__N&&(e.__=e.__N),e.i=e.__N=void 0}))):(t.__h.forEach(de),t.__h.forEach(ve),t.__h=[],Q=0)),Y=X},_e.diffed=function(e){le&&le(e);var t=e.__c;t&&t.__H&&(t.__H.__h.length&&(1!==ne.push(t)&&ee===_e.requestAnimationFrame||((ee=_e.requestAnimationFrame)||he)(fe)),t.__H.__.forEach((function(e){e.i&&(e.__H=e.i),e.i=void 0}))),Y=X=null},_e.__c=function(e,t){t.some((function(e){try{e.__h.forEach(de),e.__h=e.__h.filter((function(e){return!e.__||ve(e)}))}catch(X){t.some((function(e){e.__h&&(e.__h=[])})),t=[],_e.__e(X,e.__v)}})),ie&&ie(e,t)},_e.unmount=function(e){ue&&ue(e);var t,n=e.__c;n&&n.__H&&(n.__H.__.forEach((function(e){try{de(e)}catch(e){t=e}})),n.__H=void 0,t&&_e.__e(t,n.__v))};var pe=\"function\"==typeof requestAnimationFrame;function he(e){var t,n=function(){clearTimeout(_),pe&&cancelAnimationFrame(t),setTimeout(e)},_=setTimeout(n,100);pe&&(t=requestAnimationFrame(n))}function de(e){var t=X,n=e.__c;\"function\"==typeof n&&(e.__c=void 0,n()),X=t}function ve(e){var t=X;e.__c=e.__(),X=t}function me(e,t){return\"function\"==typeof t?t(e):t}function ye(e,t){for(var n in e)if(\"__source\"!==n&&!(n in t))return!0;for(var _ in t)if(\"__source\"!==_&&e[_]!==t[_])return!0;return!1}function ge(e,t){this.props=e,this.context=t}(ge.prototype=new b).isPureReactComponent=!0,ge.prototype.shouldComponentUpdate=function(e,t){return ye(this.props,e)||ye(this.state,t)};var be=t.__b;t.__b=function(e){e.type&&e.type.__f&&e.ref&&(e.props.ref=e.ref,e.ref=null),be&&be(e)};var ke=t.__e;t.__e=function(e,t,n,_){if(e.then)for(var r,o=t;o=o.__;)if((r=o.__c)&&r.__c)return null==t.__e&&(t.__e=n.__e,t.__k=n.__k),r.__c(e,t);ke(e,t,n,_)};var we=t.unmount;function Se(e,t,n){return e&&(e.__c&&e.__c.__H&&(e.__c.__H.__.forEach((function(e){\"function\"==typeof e.__c&&e.__c()})),e.__c.__H=null),null!=(e=function(e,t){for(var n in t)e[n]=t[n];return e}({},e)).__c&&(e.__c.__P===n&&(e.__c.__P=t),e.__c=null),e.__k=e.__k&&e.__k.map((function(e){return Se(e,t,n)}))),e}function Ce(e,t,n){return e&&n&&(e.__v=null,e.__k=e.__k&&e.__k.map((function(e){return Ce(e,t,n)})),e.__c&&e.__c.__P===t&&(e.__e&&n.appendChild(e.__e),e.__c.__e=!0,e.__c.__P=n)),e}function Pe(){this.__u=0,this.o=null,this.__b=null}function xe(e){var t=e.__.__c;return t&&t.__a&&t.__a(e)}function He(){this.i=null,this.l=null}t.unmount=function(e){var t=e.__c;t&&t.__R&&t.__R(),t&&32&e.__u&&(e.type=null),we&&we(e)},(Pe.prototype=new b).__c=function(e,t){var n=t.__c,_=this;null==_.o&&(_.o=[]),_.o.push(n);var r=xe(_.__v),o=!1,l=function(){o||(o=!0,n.__R=null,r?r(i):i())};n.__R=l;var i=function(){if(!--_.__u){if(_.state.__a){var e=_.state.__a;_.__v.__k[0]=Ce(e,e.__c.__P,e.__c.__O)}var t;for(_.setState({__a:_.__b=null});t=_.o.pop();)t.forceUpdate()}};_.__u++||32&t.__u||_.setState({__a:_.__b=_.__v.__k[0]}),e.then(l,l)},Pe.prototype.componentWillUnmount=function(){this.o=[]},Pe.prototype.render=function(e,t){if(this.__b){if(this.__v.__k){var n=document.createElement(\"div\"),_=this.__v.__k[0].__c;this.__v.__k[0]=Se(this.__b,n,_.__O=_.__P)}this.__b=null}var r=t.__a&&m(g,null,e.fallback);return r&&(r.__u&=-33),[m(g,null,t.__a?null:e.children),r]};var Ne=function(e,t,n){if(++n[1]===n[0]&&e.l.delete(t),e.props.revealOrder&&(\"t\"!==e.props.revealOrder[0]||!e.l.size))for(n=e.i;n;){for(;n.length>3;)n.pop()();if(n[1]<n[0])break;e.i=n=n[2]}};(He.prototype=new b).__a=function(e){var t=this,n=xe(t.__v),_=t.l.get(e);return _[0]++,function(r){var o=function(){t.props.revealOrder?(_.push(r),Ne(t,e,_)):r()};n?n(o):o()}},He.prototype.render=function(e){this.i=null,this.l=new Map;var t=H(e.children);e.revealOrder&&\"b\"===e.revealOrder[0]&&t.reverse();for(var n=t.length;n--;)this.l.set(t[n],this.i=[1,0,this.i]);return e.children},He.prototype.componentDidUpdate=He.prototype.componentDidMount=function(){var e=this;this.l.forEach((function(t,n){Ne(e,n,t)}))};var Ee=\"undefined\"!=typeof Symbol&&Symbol.for&&Symbol.for(\"react.element\")||60103,Ue=/^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/,Ae=/^on(Ani|Tra|Tou|BeforeInp|Compo)/,Te=/[A-Z0-9]/g,Oe=\"undefined\"!=typeof document,Me=function(e){return(\"undefined\"!=typeof Symbol&&\"symbol\"==typeof Symbol()?/fil|che|rad/:/fil|che|ra/).test(e)};b.prototype.isReactComponent={},[\"componentWillMount\",\"componentWillReceiveProps\",\"componentWillUpdate\"].forEach((function(e){Object.defineProperty(b.prototype,e,{configurable:!0,get:function(){return this[\"UNSAFE_\"+e]},set:function(t){Object.defineProperty(this,e,{configurable:!0,writable:!0,value:t})}})}));var Fe=t.event;function Ve(){}function De(){return this.cancelBubble}function Le(){return this.defaultPrevented}t.event=function(e){return Fe&&(e=Fe(e)),e.persist=Ve,e.isPropagationStopped=De,e.isDefaultPrevented=Le,e.nativeEvent=e};var Re={enumerable:!1,configurable:!0,get:function(){return this.class}},We=t.vnode;t.vnode=function(e){\"string\"==typeof e.type&&function(e){var t=e.props,n=e.type,_={},r=-1===n.indexOf(\"-\");for(var o in t){var l=t[o];if(!(\"value\"===o&&\"defaultValue\"in t&&null==l||Oe&&\"children\"===o&&\"noscript\"===n||\"class\"===o||\"className\"===o)){var i=o.toLowerCase();\"defaultValue\"===o&&\"value\"in t&&null==t.value?o=\"value\":\"download\"===o&&!0===l?l=\"\":\"translate\"===i&&\"no\"===l?l=!1:\"o\"===i[0]&&\"n\"===i[1]?\"ondoubleclick\"===i?o=\"ondblclick\":\"onchange\"!==i||\"input\"!==n&&\"textarea\"!==n||Me(t.type)?\"onfocus\"===i?o=\"onfocusin\":\"onblur\"===i?o=\"onfocusout\":Ae.test(o)&&(o=i):i=o=\"oninput\":r&&Ue.test(o)?o=o.replace(Te,\"-$&\").toLowerCase():null===l&&(l=void 0),\"oninput\"===i&&_[o=i]&&(o=\"oninputCapture\"),_[o]=l}}\"select\"==n&&_.multiple&&Array.isArray(_.value)&&(_.value=H(t.children).forEach((function(e){e.props.selected=-1!=_.value.indexOf(e.props.value)}))),\"select\"==n&&null!=_.defaultValue&&(_.value=H(t.children).forEach((function(e){e.props.selected=_.multiple?-1!=_.defaultValue.indexOf(e.props.value):_.defaultValue==e.props.value}))),t.class&&!t.className?(_.class=t.class,Object.defineProperty(_,\"className\",Re)):(t.className&&!t.class||t.class&&t.className)&&(_.class=_.className=t.className),e.props=_}(e),e.$$typeof=Ee,We&&We(e)};var je=t.__r;t.__r=function(e){je&&je(e)};var $e=t.diffed;t.diffed=function(e){$e&&$e(e);var t=e.props,n=e.__e;null!=n&&\"textarea\"===e.type&&\"value\"in t&&t.value!==n.value&&(n.value=null==t.value?\"\":t.value)};!function(e,t,n,_){B.p=t}(0,void 0),function(n,_,r){var o,l,i,u;_==document&&(_=document.documentElement),t.__&&t.__(n,_),l=(o=\"function\"==typeof r)?null:r&&r.__k||_.__k,i=[],u=[],T(_,n=(!o&&r||_).__k=m(g,null,[n]),l||a,a,_.namespaceURI,!o&&r?[r]:l?null:_.firstChild?e.call(_.childNodes):null,i,!o&&r?r:l?l.__e:_.firstChild,o,u),O(i,n,u)}(R`<${()=>{const[e,t]=ae(void 0);return function(e,t){var n=se(Q++,3);!_e.__s&&function(e,t){return!e||e.length!==t.length||t.some((function(t,n){return t!==e[n]}))}(n.__H,t)&&(n.__=e,n.i=t,X.__H.__h.push(n))}((()=>{document.addEventListener(\"message\",(e=>{try{const n=e.data;switch(n.type){case\"SEND_INITIAL_DATA\":{const{verses:e,parallelVerses:_,focusVerses:r,secondaryVerses:o,comments:l,selectedVerses:i,highlightedVerses:u,notedVerses:c,settings:s,verseToScroll:a,version:f,pericopeChapter:p,chapter:h,isSelectionMode:d,selectedCode:v,isReadOnly:m,dispatch:y}=n;t({verses:e,parallelVerses:_,focusVerses:r,secondaryVerses:o,selectedVerses:i,highlightedVerses:u,notedVerses:c,settings:s,verseToScroll:a,version:f,pericopeChapter:p,chapter:h,isSelectionMode:d,selectedCode:v,comments:l,isReadOnly:m,dispatch:y});break}}}catch(n){}}))}),[]),R`<div>Hello</div>`}}/>`,document.body);</script></body></html>"