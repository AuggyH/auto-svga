//#region \0rolldown/runtime.js
var e = Object.create, t = Object.defineProperty, n = Object.getOwnPropertyDescriptor, r = Object.getOwnPropertyNames, i = Object.getPrototypeOf, a = Object.prototype.hasOwnProperty, o = (e, t) => () => (t || (e((t = { exports: {} }).exports, t), e = null), t.exports), s = (e, i, o, s) => {
	if (i && typeof i == "object" || typeof i == "function") for (var c = r(i), l = 0, u = c.length, d; l < u; l++) d = c[l], !a.call(e, d) && d !== o && t(e, d, {
		get: ((e) => i[e]).bind(null, d),
		enumerable: !(s = n(i, d)) || s.enumerable
	});
	return e;
}, c = (n, r, a) => (a = n == null ? {} : e(i(n)), s(r || !n || !n.__esModule ? t(a, "default", {
	value: n,
	enumerable: !0
}) : a, n)), l = /* @__PURE__ */ ((e) => typeof require < "u" ? require : typeof Proxy < "u" ? new Proxy(e, { get: (e, t) => (typeof require < "u" ? require : e)[t] }) : e)(function(e) {
	if (typeof require < "u") return require.apply(this, arguments);
	throw Error("Calling `require` for \"" + e + "\" in an environment that doesn't expose the `require` function. See https://rolldown.rs/in-depth/bundling-cjs#require-external-modules for more details.");
}), u = class {
	constructor() {
		this.request = null;
	}
	get(e) {
		if (!e) throw Error("download link undefined");
		return new Promise((t, n) => {
			let r = new XMLHttpRequest();
			r.open("GET", e, !0), r.responseType = "arraybuffer", r.onloadend = () => {
				r.response && (r.status === 200 || r.status === 304) ? t(r.response) : n(r);
			}, r.onerror = () => n(r.response), r.send(), this.request = r;
		});
	}
	cancel() {
		this.request?.abort();
	}
	destroy() {
		this.request?.abort();
	}
}, d = "(function(){var e=Object.create,t=Object.defineProperty,n=Object.getOwnPropertyDescriptor,r=Object.getOwnPropertyNames,i=Object.getPrototypeOf,a=Object.prototype.hasOwnProperty,o=(e,t)=>()=>(t||(e((t={exports:{}}).exports,t),e=null),t.exports),s=(e,i,o,s)=>{if(i&&typeof i==`object`||typeof i==`function`)for(var c=r(i),l=0,u=c.length,d;l<u;l++)d=c[l],!a.call(e,d)&&d!==o&&t(e,d,{get:(e=>i[e]).bind(null,d),enumerable:!(s=n(i,d))||s.enumerable});return e},c=(n,r,a)=>(a=n==null?{}:e(i(n)),s(r||!n||!n.__esModule?t(a,`default`,{value:n,enumerable:!0}):a,n))\n/*! pako 2.1.0 https://github.com/nodeca/pako @license (MIT AND Zlib) */\n;function l(e){let t=e.length;for(;--t>=0;)e[t]=0}let u=new Uint8Array([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0]),d=new Uint8Array([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13]),f=new Uint8Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,3,7]),p=new Uint8Array([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]),m=Array(288*2);l(m);let h=Array(60);l(h);let g=Array(512);l(g);let _=Array(256);l(_);let v=Array(29);l(v);let y=Array(30);l(y);function b(e,t,n,r,i){this.static_tree=e,this.extra_bits=t,this.extra_base=n,this.elems=r,this.max_length=i,this.has_stree=e&&e.length}let x,S,C;function w(e,t){this.dyn_tree=e,this.max_code=0,this.stat_desc=t}let T=e=>e<256?g[e]:g[256+(e>>>7)],E=(e,t)=>{e.pending_buf[e.pending++]=t&255,e.pending_buf[e.pending++]=t>>>8&255},D=(e,t,n)=>{e.bi_valid>16-n?(e.bi_buf|=t<<e.bi_valid&65535,E(e,e.bi_buf),e.bi_buf=t>>16-e.bi_valid,e.bi_valid+=n-16):(e.bi_buf|=t<<e.bi_valid&65535,e.bi_valid+=n)},O=(e,t,n)=>{D(e,n[t*2],n[t*2+1])},ee=(e,t)=>{let n=0;do n|=e&1,e>>>=1,n<<=1;while(--t>0);return n>>>1},te=e=>{e.bi_valid===16?(E(e,e.bi_buf),e.bi_buf=0,e.bi_valid=0):e.bi_valid>=8&&(e.pending_buf[e.pending++]=e.bi_buf&255,e.bi_buf>>=8,e.bi_valid-=8)},ne=(e,t)=>{let n=t.dyn_tree,r=t.max_code,i=t.stat_desc.static_tree,a=t.stat_desc.has_stree,o=t.stat_desc.extra_bits,s=t.stat_desc.extra_base,c=t.stat_desc.max_length,l,u,d,f,p,m,h=0;for(f=0;f<=15;f++)e.bl_count[f]=0;for(n[e.heap[e.heap_max]*2+1]=0,l=e.heap_max+1;l<573;l++)u=e.heap[l],f=n[n[u*2+1]*2+1]+1,f>c&&(f=c,h++),n[u*2+1]=f,!(u>r)&&(e.bl_count[f]++,p=0,u>=s&&(p=o[u-s]),m=n[u*2],e.opt_len+=m*(f+p),a&&(e.static_len+=m*(i[u*2+1]+p)));if(h!==0){do{for(f=c-1;e.bl_count[f]===0;)f--;e.bl_count[f]--,e.bl_count[f+1]+=2,e.bl_count[c]--,h-=2}while(h>0);for(f=c;f!==0;f--)for(u=e.bl_count[f];u!==0;)d=e.heap[--l],!(d>r)&&(n[d*2+1]!==f&&(e.opt_len+=(f-n[d*2+1])*n[d*2],n[d*2+1]=f),u--)}},re=(e,t,n)=>{let r=Array(16),i=0,a,o;for(a=1;a<=15;a++)i=i+n[a-1]<<1,r[a]=i;for(o=0;o<=t;o++){let t=e[o*2+1];t!==0&&(e[o*2]=ee(r[t]++,t))}},ie=()=>{let e,t,n,r,i,a=Array(16);for(n=0,r=0;r<28;r++)for(v[r]=n,e=0;e<1<<u[r];e++)_[n++]=r;for(_[n-1]=r,i=0,r=0;r<16;r++)for(y[r]=i,e=0;e<1<<d[r];e++)g[i++]=r;for(i>>=7;r<30;r++)for(y[r]=i<<7,e=0;e<1<<d[r]-7;e++)g[256+ i++]=r;for(t=0;t<=15;t++)a[t]=0;for(e=0;e<=143;)m[e*2+1]=8,e++,a[8]++;for(;e<=255;)m[e*2+1]=9,e++,a[9]++;for(;e<=279;)m[e*2+1]=7,e++,a[7]++;for(;e<=287;)m[e*2+1]=8,e++,a[8]++;for(re(m,287,a),e=0;e<30;e++)h[e*2+1]=5,h[e*2]=ee(e,5);x=new b(m,u,257,286,15),S=new b(h,d,0,30,15),C=new b([],f,0,19,7)},ae=e=>{let t;for(t=0;t<286;t++)e.dyn_ltree[t*2]=0;for(t=0;t<30;t++)e.dyn_dtree[t*2]=0;for(t=0;t<19;t++)e.bl_tree[t*2]=0;e.dyn_ltree[256*2]=1,e.opt_len=e.static_len=0,e.sym_next=e.matches=0},oe=e=>{e.bi_valid>8?E(e,e.bi_buf):e.bi_valid>0&&(e.pending_buf[e.pending++]=e.bi_buf),e.bi_buf=0,e.bi_valid=0},se=(e,t,n,r)=>{let i=t*2,a=n*2;return e[i]<e[a]||e[i]===e[a]&&r[t]<=r[n]},ce=(e,t,n)=>{let r=e.heap[n],i=n<<1;for(;i<=e.heap_len&&(i<e.heap_len&&se(t,e.heap[i+1],e.heap[i],e.depth)&&i++,!se(t,r,e.heap[i],e.depth));)e.heap[n]=e.heap[i],n=i,i<<=1;e.heap[n]=r},le=(e,t,n)=>{let r,i,a=0,o,s;if(e.sym_next!==0)do r=e.pending_buf[e.sym_buf+ a++]&255,r+=(e.pending_buf[e.sym_buf+ a++]&255)<<8,i=e.pending_buf[e.sym_buf+ a++],r===0?O(e,i,t):(o=_[i],O(e,o+256+1,t),s=u[o],s!==0&&(i-=v[o],D(e,i,s)),r--,o=T(r),O(e,o,n),s=d[o],s!==0&&(r-=y[o],D(e,r,s)));while(a<e.sym_next);O(e,256,t)},ue=(e,t)=>{let n=t.dyn_tree,r=t.stat_desc.static_tree,i=t.stat_desc.has_stree,a=t.stat_desc.elems,o,s,c=-1,l;for(e.heap_len=0,e.heap_max=573,o=0;o<a;o++)n[o*2]===0?n[o*2+1]=0:(e.heap[++e.heap_len]=c=o,e.depth[o]=0);for(;e.heap_len<2;)l=e.heap[++e.heap_len]=c<2?++c:0,n[l*2]=1,e.depth[l]=0,e.opt_len--,i&&(e.static_len-=r[l*2+1]);for(t.max_code=c,o=e.heap_len>>1;o>=1;o--)ce(e,n,o);l=a;do o=e.heap[1],e.heap[1]=e.heap[e.heap_len--],ce(e,n,1),s=e.heap[1],e.heap[--e.heap_max]=o,e.heap[--e.heap_max]=s,n[l*2]=n[o*2]+n[s*2],e.depth[l]=(e.depth[o]>=e.depth[s]?e.depth[o]:e.depth[s])+1,n[o*2+1]=n[s*2+1]=l,e.heap[1]=l++,ce(e,n,1);while(e.heap_len>=2);e.heap[--e.heap_max]=e.heap[1],ne(e,t),re(n,c,e.bl_count)},de=(e,t,n)=>{let r,i=-1,a,o=t[1],s=0,c=7,l=4;for(o===0&&(c=138,l=3),t[(n+1)*2+1]=65535,r=0;r<=n;r++)a=o,o=t[(r+1)*2+1],!(++s<c&&a===o)&&(s<l?e.bl_tree[a*2]+=s:a===0?s<=10?e.bl_tree[34]++:e.bl_tree[36]++:(a!==i&&e.bl_tree[a*2]++,e.bl_tree[32]++),s=0,i=a,o===0?(c=138,l=3):a===o?(c=6,l=3):(c=7,l=4))},fe=(e,t,n)=>{let r,i=-1,a,o=t[1],s=0,c=7,l=4;for(o===0&&(c=138,l=3),r=0;r<=n;r++)if(a=o,o=t[(r+1)*2+1],!(++s<c&&a===o)){if(s<l)do O(e,a,e.bl_tree);while(--s!==0);else a===0?s<=10?(O(e,17,e.bl_tree),D(e,s-3,3)):(O(e,18,e.bl_tree),D(e,s-11,7)):(a!==i&&(O(e,a,e.bl_tree),s--),O(e,16,e.bl_tree),D(e,s-3,2));s=0,i=a,o===0?(c=138,l=3):a===o?(c=6,l=3):(c=7,l=4)}},pe=e=>{let t;for(de(e,e.dyn_ltree,e.l_desc.max_code),de(e,e.dyn_dtree,e.d_desc.max_code),ue(e,e.bl_desc),t=18;t>=3&&e.bl_tree[p[t]*2+1]===0;t--);return e.opt_len+=3*(t+1)+5+5+4,t},me=(e,t,n,r)=>{let i;for(D(e,t-257,5),D(e,n-1,5),D(e,r-4,4),i=0;i<r;i++)D(e,e.bl_tree[p[i]*2+1],3);fe(e,e.dyn_ltree,t-1),fe(e,e.dyn_dtree,n-1)},he=e=>{let t=4093624447,n;for(n=0;n<=31;n++,t>>>=1)if(t&1&&e.dyn_ltree[n*2]!==0)return 0;if(e.dyn_ltree[18]!==0||e.dyn_ltree[20]!==0||e.dyn_ltree[26]!==0)return 1;for(n=32;n<256;n++)if(e.dyn_ltree[n*2]!==0)return 1;return 0},ge=!1,_e=e=>{ge||=(ie(),!0),e.l_desc=new w(e.dyn_ltree,x),e.d_desc=new w(e.dyn_dtree,S),e.bl_desc=new w(e.bl_tree,C),e.bi_buf=0,e.bi_valid=0,ae(e)},ve=(e,t,n,r)=>{D(e,0+ +!!r,3),oe(e),E(e,n),E(e,~n),n&&e.pending_buf.set(e.window.subarray(t,t+n),e.pending),e.pending+=n};var ye={_tr_init:_e,_tr_stored_block:ve,_tr_flush_block:(e,t,n,r)=>{let i,a,o=0;e.level>0?(e.strm.data_type===2&&(e.strm.data_type=he(e)),ue(e,e.l_desc),ue(e,e.d_desc),o=pe(e),i=e.opt_len+3+7>>>3,a=e.static_len+3+7>>>3,a<=i&&(i=a)):i=a=n+5,n+4<=i&&t!==-1?ve(e,t,n,r):e.strategy===4||a===i?(D(e,2+ +!!r,3),le(e,m,h)):(D(e,4+ +!!r,3),me(e,e.l_desc.max_code+1,e.d_desc.max_code+1,o+1),le(e,e.dyn_ltree,e.dyn_dtree)),ae(e),r&&oe(e)},_tr_tally:(e,t,n)=>(e.pending_buf[e.sym_buf+ e.sym_next++]=t,e.pending_buf[e.sym_buf+ e.sym_next++]=t>>8,e.pending_buf[e.sym_buf+ e.sym_next++]=n,t===0?e.dyn_ltree[n*2]++:(e.matches++,t--,e.dyn_ltree[(_[n]+256+1)*2]++,e.dyn_dtree[T(t)*2]++),e.sym_next===e.sym_end),_tr_align:e=>{D(e,2,3),O(e,256,m),te(e)}},be=(e,t,n,r)=>{let i=e&65535|0,a=e>>>16&65535|0,o=0;for(;n!==0;){o=n>2e3?2e3:n,n-=o;do i=i+t[r++]|0,a=a+i|0;while(--o);i%=65521,a%=65521}return i|a<<16|0};let xe=new Uint32Array((()=>{let e,t=[];for(var n=0;n<256;n++){e=n;for(var r=0;r<8;r++)e=e&1?3988292384^e>>>1:e>>>1;t[n]=e}return t})());var k=(e,t,n,r)=>{let i=xe,a=r+n;e^=-1;for(let n=r;n<a;n++)e=e>>>8^i[(e^t[n])&255];return e^-1},Se={2:`need dictionary`,1:`stream end`,0:``,\"-1\":`file error`,\"-2\":`stream error`,\"-3\":`data error`,\"-4\":`insufficient memory`,\"-5\":`buffer error`,\"-6\":`incompatible version`},A={Z_NO_FLUSH:0,Z_PARTIAL_FLUSH:1,Z_SYNC_FLUSH:2,Z_FULL_FLUSH:3,Z_FINISH:4,Z_BLOCK:5,Z_TREES:6,Z_OK:0,Z_STREAM_END:1,Z_NEED_DICT:2,Z_ERRNO:-1,Z_STREAM_ERROR:-2,Z_DATA_ERROR:-3,Z_MEM_ERROR:-4,Z_BUF_ERROR:-5,Z_NO_COMPRESSION:0,Z_BEST_SPEED:1,Z_BEST_COMPRESSION:9,Z_DEFAULT_COMPRESSION:-1,Z_FILTERED:1,Z_HUFFMAN_ONLY:2,Z_RLE:3,Z_FIXED:4,Z_DEFAULT_STRATEGY:0,Z_BINARY:0,Z_TEXT:1,Z_UNKNOWN:2,Z_DEFLATED:8};let{_tr_init:Ce,_tr_stored_block:we,_tr_flush_block:Te,_tr_tally:j,_tr_align:Ee}=ye,{Z_NO_FLUSH:M,Z_PARTIAL_FLUSH:De,Z_FULL_FLUSH:Oe,Z_FINISH:N,Z_BLOCK:ke,Z_OK:P,Z_STREAM_END:Ae,Z_STREAM_ERROR:F,Z_DATA_ERROR:je,Z_BUF_ERROR:Me,Z_DEFAULT_COMPRESSION:Ne,Z_FILTERED:Pe,Z_HUFFMAN_ONLY:Fe,Z_RLE:Ie,Z_FIXED:Le,Z_DEFAULT_STRATEGY:Re,Z_UNKNOWN:ze,Z_DEFLATED:Be}=A,I=(e,t)=>(e.msg=Se[t],t),Ve=e=>e*2-(e>4?9:0),L=e=>{let t=e.length;for(;--t>=0;)e[t]=0},He=e=>{let t,n,r,i=e.w_size;t=e.hash_size,r=t;do n=e.head[--r],e.head[r]=n>=i?n-i:0;while(--t);t=i,r=t;do n=e.prev[--r],e.prev[r]=n>=i?n-i:0;while(--t)},R=(e,t,n)=>(t<<e.hash_shift^n)&e.hash_mask,z=e=>{let t=e.state,n=t.pending;n>e.avail_out&&(n=e.avail_out),n!==0&&(e.output.set(t.pending_buf.subarray(t.pending_out,t.pending_out+n),e.next_out),e.next_out+=n,t.pending_out+=n,e.total_out+=n,e.avail_out-=n,t.pending-=n,t.pending===0&&(t.pending_out=0))},B=(e,t)=>{Te(e,e.block_start>=0?e.block_start:-1,e.strstart-e.block_start,t),e.block_start=e.strstart,z(e.strm)},V=(e,t)=>{e.pending_buf[e.pending++]=t},Ue=(e,t)=>{e.pending_buf[e.pending++]=t>>>8&255,e.pending_buf[e.pending++]=t&255},We=(e,t,n,r)=>{let i=e.avail_in;return i>r&&(i=r),i===0?0:(e.avail_in-=i,t.set(e.input.subarray(e.next_in,e.next_in+i),n),e.state.wrap===1?e.adler=be(e.adler,t,i,n):e.state.wrap===2&&(e.adler=k(e.adler,t,i,n)),e.next_in+=i,e.total_in+=i,i)},Ge=(e,t)=>{let n=e.max_chain_length,r=e.strstart,i,a,o=e.prev_length,s=e.nice_match,c=e.strstart>e.w_size-262?e.strstart-(e.w_size-262):0,l=e.window,u=e.w_mask,d=e.prev,f=e.strstart+258,p=l[r+o-1],m=l[r+o];e.prev_length>=e.good_match&&(n>>=2),s>e.lookahead&&(s=e.lookahead);do{if(i=t,l[i+o]!==m||l[i+o-1]!==p||l[i]!==l[r]||l[++i]!==l[r+1])continue;r+=2,i++;do;while(l[++r]===l[++i]&&l[++r]===l[++i]&&l[++r]===l[++i]&&l[++r]===l[++i]&&l[++r]===l[++i]&&l[++r]===l[++i]&&l[++r]===l[++i]&&l[++r]===l[++i]&&r<f);if(a=258-(f-r),r=f-258,a>o){if(e.match_start=t,o=a,a>=s)break;p=l[r+o-1],m=l[r+o]}}while((t=d[t&u])>c&&--n!==0);return o<=e.lookahead?o:e.lookahead},Ke=e=>{let t=e.w_size,n,r,i;do{if(r=e.window_size-e.lookahead-e.strstart,e.strstart>=t+(t-262)&&(e.window.set(e.window.subarray(t,t+t-r),0),e.match_start-=t,e.strstart-=t,e.block_start-=t,e.insert>e.strstart&&(e.insert=e.strstart),He(e),r+=t),e.strm.avail_in===0)break;if(n=We(e.strm,e.window,e.strstart+e.lookahead,r),e.lookahead+=n,e.lookahead+e.insert>=3)for(i=e.strstart-e.insert,e.ins_h=e.window[i],e.ins_h=R(e,e.ins_h,e.window[i+1]);e.insert&&(e.ins_h=R(e,e.ins_h,e.window[i+3-1]),e.prev[i&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=i,i++,e.insert--,!(e.lookahead+e.insert<3)););}while(e.lookahead<262&&e.strm.avail_in!==0)},qe=(e,t)=>{let n=e.pending_buf_size-5>e.w_size?e.w_size:e.pending_buf_size-5,r,i,a,o=0,s=e.strm.avail_in;do{if(r=65535,a=e.bi_valid+42>>3,e.strm.avail_out<a||(a=e.strm.avail_out-a,i=e.strstart-e.block_start,r>i+e.strm.avail_in&&(r=i+e.strm.avail_in),r>a&&(r=a),r<n&&(r===0&&t!==N||t===M||r!==i+e.strm.avail_in)))break;o=+(t===N&&r===i+e.strm.avail_in),we(e,0,0,o),e.pending_buf[e.pending-4]=r,e.pending_buf[e.pending-3]=r>>8,e.pending_buf[e.pending-2]=~r,e.pending_buf[e.pending-1]=~r>>8,z(e.strm),i&&(i>r&&(i=r),e.strm.output.set(e.window.subarray(e.block_start,e.block_start+i),e.strm.next_out),e.strm.next_out+=i,e.strm.avail_out-=i,e.strm.total_out+=i,e.block_start+=i,r-=i),r&&(We(e.strm,e.strm.output,e.strm.next_out,r),e.strm.next_out+=r,e.strm.avail_out-=r,e.strm.total_out+=r)}while(o===0);return s-=e.strm.avail_in,s&&(s>=e.w_size?(e.matches=2,e.window.set(e.strm.input.subarray(e.strm.next_in-e.w_size,e.strm.next_in),0),e.strstart=e.w_size,e.insert=e.strstart):(e.window_size-e.strstart<=s&&(e.strstart-=e.w_size,e.window.set(e.window.subarray(e.w_size,e.w_size+e.strstart),0),e.matches<2&&e.matches++,e.insert>e.strstart&&(e.insert=e.strstart)),e.window.set(e.strm.input.subarray(e.strm.next_in-s,e.strm.next_in),e.strstart),e.strstart+=s,e.insert+=s>e.w_size-e.insert?e.w_size-e.insert:s),e.block_start=e.strstart),e.high_water<e.strstart&&(e.high_water=e.strstart),o?4:t!==M&&t!==N&&e.strm.avail_in===0&&e.strstart===e.block_start?2:(a=e.window_size-e.strstart,e.strm.avail_in>a&&e.block_start>=e.w_size&&(e.block_start-=e.w_size,e.strstart-=e.w_size,e.window.set(e.window.subarray(e.w_size,e.w_size+e.strstart),0),e.matches<2&&e.matches++,a+=e.w_size,e.insert>e.strstart&&(e.insert=e.strstart)),a>e.strm.avail_in&&(a=e.strm.avail_in),a&&(We(e.strm,e.window,e.strstart,a),e.strstart+=a,e.insert+=a>e.w_size-e.insert?e.w_size-e.insert:a),e.high_water<e.strstart&&(e.high_water=e.strstart),a=e.bi_valid+42>>3,a=e.pending_buf_size-a>65535?65535:e.pending_buf_size-a,n=a>e.w_size?e.w_size:a,i=e.strstart-e.block_start,(i>=n||(i||t===N)&&t!==M&&e.strm.avail_in===0&&i<=a)&&(r=i>a?a:i,o=+(t===N&&e.strm.avail_in===0&&r===i),we(e,e.block_start,r,o),e.block_start+=r,z(e.strm)),o?3:1)},Je=(e,t)=>{let n,r;for(;;){if(e.lookahead<262){if(Ke(e),e.lookahead<262&&t===M)return 1;if(e.lookahead===0)break}if(n=0,e.lookahead>=3&&(e.ins_h=R(e,e.ins_h,e.window[e.strstart+3-1]),n=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart),n!==0&&e.strstart-n<=e.w_size-262&&(e.match_length=Ge(e,n)),e.match_length>=3)if(r=j(e,e.strstart-e.match_start,e.match_length-3),e.lookahead-=e.match_length,e.match_length<=e.max_lazy_match&&e.lookahead>=3){e.match_length--;do e.strstart++,e.ins_h=R(e,e.ins_h,e.window[e.strstart+3-1]),n=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart;while(--e.match_length!==0);e.strstart++}else e.strstart+=e.match_length,e.match_length=0,e.ins_h=e.window[e.strstart],e.ins_h=R(e,e.ins_h,e.window[e.strstart+1]);else r=j(e,0,e.window[e.strstart]),e.lookahead--,e.strstart++;if(r&&(B(e,!1),e.strm.avail_out===0))return 1}return e.insert=e.strstart<2?e.strstart:2,t===N?(B(e,!0),e.strm.avail_out===0?3:4):e.sym_next&&(B(e,!1),e.strm.avail_out===0)?1:2},Ye=(e,t)=>{let n,r,i;for(;;){if(e.lookahead<262){if(Ke(e),e.lookahead<262&&t===M)return 1;if(e.lookahead===0)break}if(n=0,e.lookahead>=3&&(e.ins_h=R(e,e.ins_h,e.window[e.strstart+3-1]),n=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart),e.prev_length=e.match_length,e.prev_match=e.match_start,e.match_length=2,n!==0&&e.prev_length<e.max_lazy_match&&e.strstart-n<=e.w_size-262&&(e.match_length=Ge(e,n),e.match_length<=5&&(e.strategy===Pe||e.match_length===3&&e.strstart-e.match_start>4096)&&(e.match_length=2)),e.prev_length>=3&&e.match_length<=e.prev_length){i=e.strstart+e.lookahead-3,r=j(e,e.strstart-1-e.prev_match,e.prev_length-3),e.lookahead-=e.prev_length-1,e.prev_length-=2;do++e.strstart<=i&&(e.ins_h=R(e,e.ins_h,e.window[e.strstart+3-1]),n=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart);while(--e.prev_length!==0);if(e.match_available=0,e.match_length=2,e.strstart++,r&&(B(e,!1),e.strm.avail_out===0))return 1}else if(e.match_available){if(r=j(e,0,e.window[e.strstart-1]),r&&B(e,!1),e.strstart++,e.lookahead--,e.strm.avail_out===0)return 1}else e.match_available=1,e.strstart++,e.lookahead--}return e.match_available&&=(r=j(e,0,e.window[e.strstart-1]),0),e.insert=e.strstart<2?e.strstart:2,t===N?(B(e,!0),e.strm.avail_out===0?3:4):e.sym_next&&(B(e,!1),e.strm.avail_out===0)?1:2},Xe=(e,t)=>{let n,r,i,a,o=e.window;for(;;){if(e.lookahead<=258){if(Ke(e),e.lookahead<=258&&t===M)return 1;if(e.lookahead===0)break}if(e.match_length=0,e.lookahead>=3&&e.strstart>0&&(i=e.strstart-1,r=o[i],r===o[++i]&&r===o[++i]&&r===o[++i])){a=e.strstart+258;do;while(r===o[++i]&&r===o[++i]&&r===o[++i]&&r===o[++i]&&r===o[++i]&&r===o[++i]&&r===o[++i]&&r===o[++i]&&i<a);e.match_length=258-(a-i),e.match_length>e.lookahead&&(e.match_length=e.lookahead)}if(e.match_length>=3?(n=j(e,1,e.match_length-3),e.lookahead-=e.match_length,e.strstart+=e.match_length,e.match_length=0):(n=j(e,0,e.window[e.strstart]),e.lookahead--,e.strstart++),n&&(B(e,!1),e.strm.avail_out===0))return 1}return e.insert=0,t===N?(B(e,!0),e.strm.avail_out===0?3:4):e.sym_next&&(B(e,!1),e.strm.avail_out===0)?1:2},Ze=(e,t)=>{let n;for(;;){if(e.lookahead===0&&(Ke(e),e.lookahead===0)){if(t===M)return 1;break}if(e.match_length=0,n=j(e,0,e.window[e.strstart]),e.lookahead--,e.strstart++,n&&(B(e,!1),e.strm.avail_out===0))return 1}return e.insert=0,t===N?(B(e,!0),e.strm.avail_out===0?3:4):e.sym_next&&(B(e,!1),e.strm.avail_out===0)?1:2};function H(e,t,n,r,i){this.good_length=e,this.max_lazy=t,this.nice_length=n,this.max_chain=r,this.func=i}let Qe=[new H(0,0,0,0,qe),new H(4,4,8,4,Je),new H(4,5,16,8,Je),new H(4,6,32,32,Je),new H(4,4,16,16,Ye),new H(8,16,32,32,Ye),new H(8,16,128,128,Ye),new H(8,32,128,256,Ye),new H(32,128,258,1024,Ye),new H(32,258,258,4096,Ye)],$e=e=>{e.window_size=2*e.w_size,L(e.head),e.max_lazy_match=Qe[e.level].max_lazy,e.good_match=Qe[e.level].good_length,e.nice_match=Qe[e.level].nice_length,e.max_chain_length=Qe[e.level].max_chain,e.strstart=0,e.block_start=0,e.lookahead=0,e.insert=0,e.match_length=e.prev_length=2,e.match_available=0,e.ins_h=0};function et(){this.strm=null,this.status=0,this.pending_buf=null,this.pending_buf_size=0,this.pending_out=0,this.pending=0,this.wrap=0,this.gzhead=null,this.gzindex=0,this.method=Be,this.last_flush=-1,this.w_size=0,this.w_bits=0,this.w_mask=0,this.window=null,this.window_size=0,this.prev=null,this.head=null,this.ins_h=0,this.hash_size=0,this.hash_bits=0,this.hash_mask=0,this.hash_shift=0,this.block_start=0,this.match_length=0,this.prev_match=0,this.match_available=0,this.strstart=0,this.match_start=0,this.lookahead=0,this.prev_length=0,this.max_chain_length=0,this.max_lazy_match=0,this.level=0,this.strategy=0,this.good_match=0,this.nice_match=0,this.dyn_ltree=new Uint16Array(573*2),this.dyn_dtree=new Uint16Array(122),this.bl_tree=new Uint16Array(78),L(this.dyn_ltree),L(this.dyn_dtree),L(this.bl_tree),this.l_desc=null,this.d_desc=null,this.bl_desc=null,this.bl_count=new Uint16Array(16),this.heap=new Uint16Array(573),L(this.heap),this.heap_len=0,this.heap_max=0,this.depth=new Uint16Array(573),L(this.depth),this.sym_buf=0,this.lit_bufsize=0,this.sym_next=0,this.sym_end=0,this.opt_len=0,this.static_len=0,this.matches=0,this.insert=0,this.bi_buf=0,this.bi_valid=0}let tt=e=>{if(!e)return 1;let t=e.state;return+(!t||t.strm!==e||t.status!==42&&t.status!==57&&t.status!==69&&t.status!==73&&t.status!==91&&t.status!==103&&t.status!==113&&t.status!==666)},nt=e=>{if(tt(e))return I(e,F);e.total_in=e.total_out=0,e.data_type=ze;let t=e.state;return t.pending=0,t.pending_out=0,t.wrap<0&&(t.wrap=-t.wrap),t.status=t.wrap===2?57:t.wrap?42:113,e.adler=t.wrap===2?0:1,t.last_flush=-2,Ce(t),P},rt=e=>{let t=nt(e);return t===P&&$e(e.state),t},it=(e,t)=>tt(e)||e.state.wrap!==2?F:(e.state.gzhead=t,P),at=(e,t,n,r,i,a)=>{if(!e)return F;let o=1;if(t===Ne&&(t=6),r<0?(o=0,r=-r):r>15&&(o=2,r-=16),i<1||i>9||n!==Be||r<8||r>15||t<0||t>9||a<0||a>Le||r===8&&o!==1)return I(e,F);r===8&&(r=9);let s=new et;return e.state=s,s.strm=e,s.status=42,s.wrap=o,s.gzhead=null,s.w_bits=r,s.w_size=1<<s.w_bits,s.w_mask=s.w_size-1,s.hash_bits=i+7,s.hash_size=1<<s.hash_bits,s.hash_mask=s.hash_size-1,s.hash_shift=~~((s.hash_bits+3-1)/3),s.window=new Uint8Array(s.w_size*2),s.head=new Uint16Array(s.hash_size),s.prev=new Uint16Array(s.w_size),s.lit_bufsize=1<<i+6,s.pending_buf_size=s.lit_bufsize*4,s.pending_buf=new Uint8Array(s.pending_buf_size),s.sym_buf=s.lit_bufsize,s.sym_end=(s.lit_bufsize-1)*3,s.level=t,s.strategy=a,s.method=n,rt(e)};var ot={deflateInit:(e,t)=>at(e,t,Be,15,8,Re),deflateInit2:at,deflateReset:rt,deflateResetKeep:nt,deflateSetHeader:it,deflate:(e,t)=>{if(tt(e)||t>ke||t<0)return e?I(e,F):F;let n=e.state;if(!e.output||e.avail_in!==0&&!e.input||n.status===666&&t!==N)return I(e,e.avail_out===0?Me:F);let r=n.last_flush;if(n.last_flush=t,n.pending!==0){if(z(e),e.avail_out===0)return n.last_flush=-1,P}else if(e.avail_in===0&&Ve(t)<=Ve(r)&&t!==N)return I(e,Me);if(n.status===666&&e.avail_in!==0)return I(e,Me);if(n.status===42&&n.wrap===0&&(n.status=113),n.status===42){let t=Be+(n.w_bits-8<<4)<<8,r=-1;if(r=n.strategy>=Fe||n.level<2?0:n.level<6?1:n.level===6?2:3,t|=r<<6,n.strstart!==0&&(t|=32),t+=31-t%31,Ue(n,t),n.strstart!==0&&(Ue(n,e.adler>>>16),Ue(n,e.adler&65535)),e.adler=1,n.status=113,z(e),n.pending!==0)return n.last_flush=-1,P}if(n.status===57){if(e.adler=0,V(n,31),V(n,139),V(n,8),n.gzhead)V(n,+!!n.gzhead.text+(n.gzhead.hcrc?2:0)+(n.gzhead.extra?4:0)+(n.gzhead.name?8:0)+(n.gzhead.comment?16:0)),V(n,n.gzhead.time&255),V(n,n.gzhead.time>>8&255),V(n,n.gzhead.time>>16&255),V(n,n.gzhead.time>>24&255),V(n,n.level===9?2:n.strategy>=Fe||n.level<2?4:0),V(n,n.gzhead.os&255),n.gzhead.extra&&n.gzhead.extra.length&&(V(n,n.gzhead.extra.length&255),V(n,n.gzhead.extra.length>>8&255)),n.gzhead.hcrc&&(e.adler=k(e.adler,n.pending_buf,n.pending,0)),n.gzindex=0,n.status=69;else if(V(n,0),V(n,0),V(n,0),V(n,0),V(n,0),V(n,n.level===9?2:n.strategy>=Fe||n.level<2?4:0),V(n,3),n.status=113,z(e),n.pending!==0)return n.last_flush=-1,P}if(n.status===69){if(n.gzhead.extra){let t=n.pending,r=(n.gzhead.extra.length&65535)-n.gzindex;for(;n.pending+r>n.pending_buf_size;){let i=n.pending_buf_size-n.pending;if(n.pending_buf.set(n.gzhead.extra.subarray(n.gzindex,n.gzindex+i),n.pending),n.pending=n.pending_buf_size,n.gzhead.hcrc&&n.pending>t&&(e.adler=k(e.adler,n.pending_buf,n.pending-t,t)),n.gzindex+=i,z(e),n.pending!==0)return n.last_flush=-1,P;t=0,r-=i}let i=new Uint8Array(n.gzhead.extra);n.pending_buf.set(i.subarray(n.gzindex,n.gzindex+r),n.pending),n.pending+=r,n.gzhead.hcrc&&n.pending>t&&(e.adler=k(e.adler,n.pending_buf,n.pending-t,t)),n.gzindex=0}n.status=73}if(n.status===73){if(n.gzhead.name){let t=n.pending,r;do{if(n.pending===n.pending_buf_size){if(n.gzhead.hcrc&&n.pending>t&&(e.adler=k(e.adler,n.pending_buf,n.pending-t,t)),z(e),n.pending!==0)return n.last_flush=-1,P;t=0}r=n.gzindex<n.gzhead.name.length?n.gzhead.name.charCodeAt(n.gzindex++)&255:0,V(n,r)}while(r!==0);n.gzhead.hcrc&&n.pending>t&&(e.adler=k(e.adler,n.pending_buf,n.pending-t,t)),n.gzindex=0}n.status=91}if(n.status===91){if(n.gzhead.comment){let t=n.pending,r;do{if(n.pending===n.pending_buf_size){if(n.gzhead.hcrc&&n.pending>t&&(e.adler=k(e.adler,n.pending_buf,n.pending-t,t)),z(e),n.pending!==0)return n.last_flush=-1,P;t=0}r=n.gzindex<n.gzhead.comment.length?n.gzhead.comment.charCodeAt(n.gzindex++)&255:0,V(n,r)}while(r!==0);n.gzhead.hcrc&&n.pending>t&&(e.adler=k(e.adler,n.pending_buf,n.pending-t,t))}n.status=103}if(n.status===103){if(n.gzhead.hcrc){if(n.pending+2>n.pending_buf_size&&(z(e),n.pending!==0))return n.last_flush=-1,P;V(n,e.adler&255),V(n,e.adler>>8&255),e.adler=0}if(n.status=113,z(e),n.pending!==0)return n.last_flush=-1,P}if(e.avail_in!==0||n.lookahead!==0||t!==M&&n.status!==666){let r=n.level===0?qe(n,t):n.strategy===Fe?Ze(n,t):n.strategy===Ie?Xe(n,t):Qe[n.level].func(n,t);if((r===3||r===4)&&(n.status=666),r===1||r===3)return e.avail_out===0&&(n.last_flush=-1),P;if(r===2&&(t===De?Ee(n):t!==ke&&(we(n,0,0,!1),t===Oe&&(L(n.head),n.lookahead===0&&(n.strstart=0,n.block_start=0,n.insert=0))),z(e),e.avail_out===0))return n.last_flush=-1,P}return t===N?n.wrap<=0?Ae:(n.wrap===2?(V(n,e.adler&255),V(n,e.adler>>8&255),V(n,e.adler>>16&255),V(n,e.adler>>24&255),V(n,e.total_in&255),V(n,e.total_in>>8&255),V(n,e.total_in>>16&255),V(n,e.total_in>>24&255)):(Ue(n,e.adler>>>16),Ue(n,e.adler&65535)),z(e),n.wrap>0&&(n.wrap=-n.wrap),n.pending===0?Ae:P):P},deflateEnd:e=>{if(tt(e))return F;let t=e.state.status;return e.state=null,t===113?I(e,je):P},deflateSetDictionary:(e,t)=>{let n=t.length;if(tt(e))return F;let r=e.state,i=r.wrap;if(i===2||i===1&&r.status!==42||r.lookahead)return F;if(i===1&&(e.adler=be(e.adler,t,n,0)),r.wrap=0,n>=r.w_size){i===0&&(L(r.head),r.strstart=0,r.block_start=0,r.insert=0);let e=new Uint8Array(r.w_size);e.set(t.subarray(n-r.w_size,n),0),t=e,n=r.w_size}let a=e.avail_in,o=e.next_in,s=e.input;for(e.avail_in=n,e.next_in=0,e.input=t,Ke(r);r.lookahead>=3;){let e=r.strstart,t=r.lookahead-2;do r.ins_h=R(r,r.ins_h,r.window[e+3-1]),r.prev[e&r.w_mask]=r.head[r.ins_h],r.head[r.ins_h]=e,e++;while(--t);r.strstart=e,r.lookahead=2,Ke(r)}return r.strstart+=r.lookahead,r.block_start=r.strstart,r.insert=r.lookahead,r.lookahead=0,r.match_length=r.prev_length=2,r.match_available=0,e.next_in=o,e.input=s,e.avail_in=a,r.wrap=i,P},deflateInfo:`pako deflate (from Nodeca project)`};let st=(e,t)=>Object.prototype.hasOwnProperty.call(e,t);var ct={assign:function(e){let t=Array.prototype.slice.call(arguments,1);for(;t.length;){let n=t.shift();if(n){if(typeof n!=`object`)throw TypeError(n+`must be non-object`);for(let t in n)st(n,t)&&(e[t]=n[t])}}return e},flattenChunks:e=>{let t=0;for(let n=0,r=e.length;n<r;n++)t+=e[n].length;let n=new Uint8Array(t);for(let t=0,r=0,i=e.length;t<i;t++){let i=e[t];n.set(i,r),r+=i.length}return n}};let lt=!0;try{String.fromCharCode.apply(null,new Uint8Array(1))}catch{lt=!1}let ut=new Uint8Array(256);for(let e=0;e<256;e++)ut[e]=e>=252?6:e>=248?5:e>=240?4:e>=224?3:e>=192?2:1;ut[254]=ut[254]=1;var dt=e=>{if(typeof TextEncoder==`function`&&TextEncoder.prototype.encode)return new TextEncoder().encode(e);let t,n,r,i,a,o=e.length,s=0;for(i=0;i<o;i++)n=e.charCodeAt(i),(n&64512)==55296&&i+1<o&&(r=e.charCodeAt(i+1),(r&64512)==56320&&(n=65536+(n-55296<<10)+(r-56320),i++)),s+=n<128?1:n<2048?2:n<65536?3:4;for(t=new Uint8Array(s),a=0,i=0;a<s;i++)n=e.charCodeAt(i),(n&64512)==55296&&i+1<o&&(r=e.charCodeAt(i+1),(r&64512)==56320&&(n=65536+(n-55296<<10)+(r-56320),i++)),n<128?t[a++]=n:n<2048?(t[a++]=192|n>>>6,t[a++]=128|n&63):n<65536?(t[a++]=224|n>>>12,t[a++]=128|n>>>6&63,t[a++]=128|n&63):(t[a++]=240|n>>>18,t[a++]=128|n>>>12&63,t[a++]=128|n>>>6&63,t[a++]=128|n&63);return t};let ft=(e,t)=>{if(t<65534&&e.subarray&&lt)return String.fromCharCode.apply(null,e.length===t?e:e.subarray(0,t));let n=``;for(let r=0;r<t;r++)n+=String.fromCharCode(e[r]);return n};var pt={string2buf:dt,buf2string:(e,t)=>{let n=t||e.length;if(typeof TextDecoder==`function`&&TextDecoder.prototype.decode)return new TextDecoder().decode(e.subarray(0,t));let r,i,a=Array(n*2);for(i=0,r=0;r<n;){let t=e[r++];if(t<128){a[i++]=t;continue}let o=ut[t];if(o>4){a[i++]=65533,r+=o-1;continue}for(t&=o===2?31:o===3?15:7;o>1&&r<n;)t=t<<6|e[r++]&63,o--;if(o>1){a[i++]=65533;continue}t<65536?a[i++]=t:(t-=65536,a[i++]=55296|t>>10&1023,a[i++]=56320|t&1023)}return ft(a,i)},utf8border:(e,t)=>{t||=e.length,t>e.length&&(t=e.length);let n=t-1;for(;n>=0&&(e[n]&192)==128;)n--;return n<0||n===0?t:n+ut[e[n]]>t?n:t}};function mt(){this.input=null,this.next_in=0,this.avail_in=0,this.total_in=0,this.output=null,this.next_out=0,this.avail_out=0,this.total_out=0,this.msg=``,this.state=null,this.data_type=2,this.adler=0}var ht=mt;let gt=Object.prototype.toString,{Z_NO_FLUSH:_t,Z_SYNC_FLUSH:vt,Z_FULL_FLUSH:yt,Z_FINISH:bt,Z_OK:xt,Z_STREAM_END:St,Z_DEFAULT_COMPRESSION:Ct,Z_DEFAULT_STRATEGY:wt,Z_DEFLATED:Tt}=A;function Et(e){this.options=ct.assign({level:Ct,method:Tt,chunkSize:16384,windowBits:15,memLevel:8,strategy:wt},e||{});let t=this.options;t.raw&&t.windowBits>0?t.windowBits=-t.windowBits:t.gzip&&t.windowBits>0&&t.windowBits<16&&(t.windowBits+=16),this.err=0,this.msg=``,this.ended=!1,this.chunks=[],this.strm=new ht,this.strm.avail_out=0;let n=ot.deflateInit2(this.strm,t.level,t.method,t.windowBits,t.memLevel,t.strategy);if(n!==xt)throw Error(Se[n]);if(t.header&&ot.deflateSetHeader(this.strm,t.header),t.dictionary){let e;if(e=typeof t.dictionary==`string`?pt.string2buf(t.dictionary):gt.call(t.dictionary)===`[object ArrayBuffer]`?new Uint8Array(t.dictionary):t.dictionary,n=ot.deflateSetDictionary(this.strm,e),n!==xt)throw Error(Se[n]);this._dict_set=!0}}Et.prototype.push=function(e,t){let n=this.strm,r=this.options.chunkSize,i,a;if(this.ended)return!1;for(a=t===~~t?t:t===!0?bt:_t,typeof e==`string`?n.input=pt.string2buf(e):gt.call(e)===`[object ArrayBuffer]`?n.input=new Uint8Array(e):n.input=e,n.next_in=0,n.avail_in=n.input.length;;){if(n.avail_out===0&&(n.output=new Uint8Array(r),n.next_out=0,n.avail_out=r),(a===vt||a===yt)&&n.avail_out<=6){this.onData(n.output.subarray(0,n.next_out)),n.avail_out=0;continue}if(i=ot.deflate(n,a),i===St)return n.next_out>0&&this.onData(n.output.subarray(0,n.next_out)),i=ot.deflateEnd(this.strm),this.onEnd(i),this.ended=!0,i===xt;if(n.avail_out===0){this.onData(n.output);continue}if(a>0&&n.next_out>0){this.onData(n.output.subarray(0,n.next_out)),n.avail_out=0;continue}if(n.avail_in===0)break}return!0},Et.prototype.onData=function(e){this.chunks.push(e)},Et.prototype.onEnd=function(e){e===xt&&(this.result=ct.flattenChunks(this.chunks)),this.chunks=[],this.err=e,this.msg=this.strm.msg};function Dt(e,t){let n=new Et(t);if(n.push(e,!0),n.err)throw n.msg||Se[n.err];return n.result}function Ot(e,t){return t||={},t.raw=!0,Dt(e,t)}function kt(e,t){return t||={},t.gzip=!0,Dt(e,t)}var At={Deflate:Et,deflate:Dt,deflateRaw:Ot,gzip:kt,constants:A};let jt=16209;var Mt=function(e,t){let n,r,i,a,o,s,c,l,u,d,f,p,m,h,g,_,v,y,b,x,S,C,w,T,E=e.state;n=e.next_in,w=e.input,r=n+(e.avail_in-5),i=e.next_out,T=e.output,a=i-(t-e.avail_out),o=i+(e.avail_out-257),s=E.dmax,c=E.wsize,l=E.whave,u=E.wnext,d=E.window,f=E.hold,p=E.bits,m=E.lencode,h=E.distcode,g=(1<<E.lenbits)-1,_=(1<<E.distbits)-1;top:do{p<15&&(f+=w[n++]<<p,p+=8,f+=w[n++]<<p,p+=8),v=m[f&g];dolen:for(;;){if(y=v>>>24,f>>>=y,p-=y,y=v>>>16&255,y===0)T[i++]=v&65535;else if(y&16){b=v&65535,y&=15,y&&(p<y&&(f+=w[n++]<<p,p+=8),b+=f&(1<<y)-1,f>>>=y,p-=y),p<15&&(f+=w[n++]<<p,p+=8,f+=w[n++]<<p,p+=8),v=h[f&_];dodist:for(;;){if(y=v>>>24,f>>>=y,p-=y,y=v>>>16&255,y&16){if(x=v&65535,y&=15,p<y&&(f+=w[n++]<<p,p+=8,p<y&&(f+=w[n++]<<p,p+=8)),x+=f&(1<<y)-1,x>s){e.msg=`invalid distance too far back`,E.mode=jt;break top}if(f>>>=y,p-=y,y=i-a,x>y){if(y=x-y,y>l&&E.sane){e.msg=`invalid distance too far back`,E.mode=jt;break top}if(S=0,C=d,u===0){if(S+=c-y,y<b){b-=y;do T[i++]=d[S++];while(--y);S=i-x,C=T}}else if(u<y){if(S+=c+u-y,y-=u,y<b){b-=y;do T[i++]=d[S++];while(--y);if(S=0,u<b){y=u,b-=y;do T[i++]=d[S++];while(--y);S=i-x,C=T}}}else if(S+=u-y,y<b){b-=y;do T[i++]=d[S++];while(--y);S=i-x,C=T}for(;b>2;)T[i++]=C[S++],T[i++]=C[S++],T[i++]=C[S++],b-=3;b&&(T[i++]=C[S++],b>1&&(T[i++]=C[S++]))}else{S=i-x;do T[i++]=T[S++],T[i++]=T[S++],T[i++]=T[S++],b-=3;while(b>2);b&&(T[i++]=T[S++],b>1&&(T[i++]=T[S++]))}}else if(y&64){e.msg=`invalid distance code`,E.mode=jt;break top}else{v=h[(v&65535)+(f&(1<<y)-1)];continue dodist}break}}else if(!(y&64)){v=m[(v&65535)+(f&(1<<y)-1)];continue dolen}else if(y&32){E.mode=16191;break top}else{e.msg=`invalid literal/length code`,E.mode=jt;break top}break}}while(n<r&&i<o);b=p>>3,n-=b,p-=b<<3,f&=(1<<p)-1,e.next_in=n,e.next_out=i,e.avail_in=n<r?5+(r-n):5-(n-r),e.avail_out=i<o?257+(o-i):257-(i-o),E.hold=f,E.bits=p};let Nt=new Uint16Array([3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,0,0]),Pt=new Uint8Array([16,16,16,16,16,16,16,16,17,17,17,17,18,18,18,18,19,19,19,19,20,20,20,20,21,21,21,21,16,72,78]),Ft=new Uint16Array([1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577,0,0]),It=new Uint8Array([16,16,16,16,17,17,18,18,19,19,20,20,21,21,22,22,23,23,24,24,25,25,26,26,27,27,28,28,29,29,64,64]);var Lt=(e,t,n,r,i,a,o,s)=>{let c=s.bits,l=0,u=0,d=0,f=0,p=0,m=0,h=0,g=0,_=0,v=0,y,b,x,S,C,w=null,T,E=new Uint16Array(16),D=new Uint16Array(16),O=null,ee,te,ne;for(l=0;l<=15;l++)E[l]=0;for(u=0;u<r;u++)E[t[n+u]]++;for(p=c,f=15;f>=1&&E[f]===0;f--);if(p>f&&(p=f),f===0)return i[a++]=20971520,i[a++]=20971520,s.bits=1,0;for(d=1;d<f&&E[d]===0;d++);for(p<d&&(p=d),g=1,l=1;l<=15;l++)if(g<<=1,g-=E[l],g<0)return-1;if(g>0&&(e===0||f!==1))return-1;for(D[1]=0,l=1;l<15;l++)D[l+1]=D[l]+E[l];for(u=0;u<r;u++)t[n+u]!==0&&(o[D[t[n+u]]++]=u);if(e===0?(w=O=o,T=20):e===1?(w=Nt,O=Pt,T=257):(w=Ft,O=It,T=0),v=0,u=0,l=d,C=a,m=p,h=0,x=-1,_=1<<p,S=_-1,e===1&&_>852||e===2&&_>592)return 1;for(;;){ee=l-h,o[u]+1<T?(te=0,ne=o[u]):o[u]>=T?(te=O[o[u]-T],ne=w[o[u]-T]):(te=96,ne=0),y=1<<l-h,b=1<<m,d=b;do b-=y,i[C+(v>>h)+b]=ee<<24|te<<16|ne|0;while(b!==0);for(y=1<<l-1;v&y;)y>>=1;if(y===0?v=0:(v&=y-1,v+=y),u++,--E[l]===0){if(l===f)break;l=t[n+o[u]]}if(l>p&&(v&S)!==x){for(h===0&&(h=p),C+=d,m=l-h,g=1<<m;m+h<f&&(g-=E[m+h],!(g<=0));)m++,g<<=1;if(_+=1<<m,e===1&&_>852||e===2&&_>592)return 1;x=v&S,i[x]=p<<24|m<<16|C-a|0}}return v!==0&&(i[C+v]=l-h<<24|4194304),s.bits=p,0};let{Z_FINISH:Rt,Z_BLOCK:zt,Z_TREES:Bt,Z_OK:U,Z_STREAM_END:Vt,Z_NEED_DICT:Ht,Z_STREAM_ERROR:W,Z_DATA_ERROR:Ut,Z_MEM_ERROR:Wt,Z_BUF_ERROR:Gt,Z_DEFLATED:Kt}=A,qt=16180,Jt=16181,Yt=16182,Xt=16183,Zt=16184,Qt=16185,$t=16186,en=16187,tn=16188,nn=16189,rn=16190,G=16191,an=16192,on=16193,sn=16194,cn=16195,ln=16196,un=16197,dn=16198,fn=16199,pn=16200,mn=16201,hn=16202,gn=16203,_n=16204,vn=16205,yn=16206,bn=16207,xn=16208,K=16209,Sn=16210,Cn=16211,wn=e=>(e>>>24&255)+(e>>>8&65280)+((e&65280)<<8)+((e&255)<<24);function Tn(){this.strm=null,this.mode=0,this.last=!1,this.wrap=0,this.havedict=!1,this.flags=0,this.dmax=0,this.check=0,this.total=0,this.head=null,this.wbits=0,this.wsize=0,this.whave=0,this.wnext=0,this.window=null,this.hold=0,this.bits=0,this.length=0,this.offset=0,this.extra=0,this.lencode=null,this.distcode=null,this.lenbits=0,this.distbits=0,this.ncode=0,this.nlen=0,this.ndist=0,this.have=0,this.next=null,this.lens=new Uint16Array(320),this.work=new Uint16Array(288),this.lendyn=null,this.distdyn=null,this.sane=0,this.back=0,this.was=0}let q=e=>{if(!e)return 1;let t=e.state;return+(!t||t.strm!==e||t.mode<qt||t.mode>Cn)},En=e=>{if(q(e))return W;let t=e.state;return e.total_in=e.total_out=t.total=0,e.msg=``,t.wrap&&(e.adler=t.wrap&1),t.mode=qt,t.last=0,t.havedict=0,t.flags=-1,t.dmax=32768,t.head=null,t.hold=0,t.bits=0,t.lencode=t.lendyn=new Int32Array(852),t.distcode=t.distdyn=new Int32Array(592),t.sane=1,t.back=-1,U},Dn=e=>{if(q(e))return W;let t=e.state;return t.wsize=0,t.whave=0,t.wnext=0,En(e)},On=(e,t)=>{let n;if(q(e))return W;let r=e.state;return t<0?(n=0,t=-t):(n=(t>>4)+5,t<48&&(t&=15)),t&&(t<8||t>15)?W:(r.window!==null&&r.wbits!==t&&(r.window=null),r.wrap=n,r.wbits=t,Dn(e))},kn=(e,t)=>{if(!e)return W;let n=new Tn;e.state=n,n.strm=e,n.window=null,n.mode=qt;let r=On(e,t);return r!==U&&(e.state=null),r},An=e=>kn(e,15),jn=!0,Mn,Nn,Pn=e=>{if(jn){Mn=new Int32Array(512),Nn=new Int32Array(32);let t=0;for(;t<144;)e.lens[t++]=8;for(;t<256;)e.lens[t++]=9;for(;t<280;)e.lens[t++]=7;for(;t<288;)e.lens[t++]=8;for(Lt(1,e.lens,0,288,Mn,0,e.work,{bits:9}),t=0;t<32;)e.lens[t++]=5;Lt(2,e.lens,0,32,Nn,0,e.work,{bits:5}),jn=!1}e.lencode=Mn,e.lenbits=9,e.distcode=Nn,e.distbits=5},Fn=(e,t,n,r)=>{let i,a=e.state;return a.window===null&&(a.wsize=1<<a.wbits,a.wnext=0,a.whave=0,a.window=new Uint8Array(a.wsize)),r>=a.wsize?(a.window.set(t.subarray(n-a.wsize,n),0),a.wnext=0,a.whave=a.wsize):(i=a.wsize-a.wnext,i>r&&(i=r),a.window.set(t.subarray(n-r,n-r+i),a.wnext),r-=i,r?(a.window.set(t.subarray(n-r,n),0),a.wnext=r,a.whave=a.wsize):(a.wnext+=i,a.wnext===a.wsize&&(a.wnext=0),a.whave<a.wsize&&(a.whave+=i))),0};var J={inflateReset:Dn,inflateReset2:On,inflateResetKeep:En,inflateInit:An,inflateInit2:kn,inflate:(e,t)=>{let n,r,i,a,o,s,c,l,u,d,f,p,m,h,g=0,_,v,y,b,x,S,C,w,T=new Uint8Array(4),E,D,O=new Uint8Array([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]);if(q(e)||!e.output||!e.input&&e.avail_in!==0)return W;n=e.state,n.mode===G&&(n.mode=an),o=e.next_out,i=e.output,c=e.avail_out,a=e.next_in,r=e.input,s=e.avail_in,l=n.hold,u=n.bits,d=s,f=c,w=U;inf_leave:for(;;)switch(n.mode){case qt:if(n.wrap===0){n.mode=an;break}for(;u<16;){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}if(n.wrap&2&&l===35615){n.wbits===0&&(n.wbits=15),n.check=0,T[0]=l&255,T[1]=l>>>8&255,n.check=k(n.check,T,2,0),l=0,u=0,n.mode=Jt;break}if(n.head&&(n.head.done=!1),!(n.wrap&1)||(((l&255)<<8)+(l>>8))%31){e.msg=`incorrect header check`,n.mode=K;break}if((l&15)!==Kt){e.msg=`unknown compression method`,n.mode=K;break}if(l>>>=4,u-=4,C=(l&15)+8,n.wbits===0&&(n.wbits=C),C>15||C>n.wbits){e.msg=`invalid window size`,n.mode=K;break}n.dmax=1<<n.wbits,n.flags=0,e.adler=n.check=1,n.mode=l&512?nn:G,l=0,u=0;break;case Jt:for(;u<16;){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}if(n.flags=l,(n.flags&255)!==Kt){e.msg=`unknown compression method`,n.mode=K;break}if(n.flags&57344){e.msg=`unknown header flags set`,n.mode=K;break}n.head&&(n.head.text=l>>8&1),n.flags&512&&n.wrap&4&&(T[0]=l&255,T[1]=l>>>8&255,n.check=k(n.check,T,2,0)),l=0,u=0,n.mode=Yt;case Yt:for(;u<32;){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}n.head&&(n.head.time=l),n.flags&512&&n.wrap&4&&(T[0]=l&255,T[1]=l>>>8&255,T[2]=l>>>16&255,T[3]=l>>>24&255,n.check=k(n.check,T,4,0)),l=0,u=0,n.mode=Xt;case Xt:for(;u<16;){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}n.head&&(n.head.xflags=l&255,n.head.os=l>>8),n.flags&512&&n.wrap&4&&(T[0]=l&255,T[1]=l>>>8&255,n.check=k(n.check,T,2,0)),l=0,u=0,n.mode=Zt;case Zt:if(n.flags&1024){for(;u<16;){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}n.length=l,n.head&&(n.head.extra_len=l),n.flags&512&&n.wrap&4&&(T[0]=l&255,T[1]=l>>>8&255,n.check=k(n.check,T,2,0)),l=0,u=0}else n.head&&(n.head.extra=null);n.mode=Qt;case Qt:if(n.flags&1024&&(p=n.length,p>s&&(p=s),p&&(n.head&&(C=n.head.extra_len-n.length,n.head.extra||(n.head.extra=new Uint8Array(n.head.extra_len)),n.head.extra.set(r.subarray(a,a+p),C)),n.flags&512&&n.wrap&4&&(n.check=k(n.check,r,p,a)),s-=p,a+=p,n.length-=p),n.length))break inf_leave;n.length=0,n.mode=$t;case $t:if(n.flags&2048){if(s===0)break inf_leave;p=0;do C=r[a+ p++],n.head&&C&&n.length<65536&&(n.head.name+=String.fromCharCode(C));while(C&&p<s);if(n.flags&512&&n.wrap&4&&(n.check=k(n.check,r,p,a)),s-=p,a+=p,C)break inf_leave}else n.head&&(n.head.name=null);n.length=0,n.mode=en;case en:if(n.flags&4096){if(s===0)break inf_leave;p=0;do C=r[a+ p++],n.head&&C&&n.length<65536&&(n.head.comment+=String.fromCharCode(C));while(C&&p<s);if(n.flags&512&&n.wrap&4&&(n.check=k(n.check,r,p,a)),s-=p,a+=p,C)break inf_leave}else n.head&&(n.head.comment=null);n.mode=tn;case tn:if(n.flags&512){for(;u<16;){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}if(n.wrap&4&&l!==(n.check&65535)){e.msg=`header crc mismatch`,n.mode=K;break}l=0,u=0}n.head&&(n.head.hcrc=n.flags>>9&1,n.head.done=!0),e.adler=n.check=0,n.mode=G;break;case nn:for(;u<32;){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}e.adler=n.check=wn(l),l=0,u=0,n.mode=rn;case rn:if(n.havedict===0)return e.next_out=o,e.avail_out=c,e.next_in=a,e.avail_in=s,n.hold=l,n.bits=u,Ht;e.adler=n.check=1,n.mode=G;case G:if(t===zt||t===Bt)break inf_leave;case an:if(n.last){l>>>=u&7,u-=u&7,n.mode=yn;break}for(;u<3;){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}switch(n.last=l&1,l>>>=1,--u,l&3){case 0:n.mode=on;break;case 1:if(Pn(n),n.mode=fn,t===Bt){l>>>=2,u-=2;break inf_leave}break;case 2:n.mode=ln;break;case 3:e.msg=`invalid block type`,n.mode=K}l>>>=2,u-=2;break;case on:for(l>>>=u&7,u-=u&7;u<32;){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}if((l&65535)!=(l>>>16^65535)){e.msg=`invalid stored block lengths`,n.mode=K;break}if(n.length=l&65535,l=0,u=0,n.mode=sn,t===Bt)break inf_leave;case sn:n.mode=cn;case cn:if(p=n.length,p){if(p>s&&(p=s),p>c&&(p=c),p===0)break inf_leave;i.set(r.subarray(a,a+p),o),s-=p,a+=p,c-=p,o+=p,n.length-=p;break}n.mode=G;break;case ln:for(;u<14;){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}if(n.nlen=(l&31)+257,l>>>=5,u-=5,n.ndist=(l&31)+1,l>>>=5,u-=5,n.ncode=(l&15)+4,l>>>=4,u-=4,n.nlen>286||n.ndist>30){e.msg=`too many length or distance symbols`,n.mode=K;break}n.have=0,n.mode=un;case un:for(;n.have<n.ncode;){for(;u<3;){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}n.lens[O[n.have++]]=l&7,l>>>=3,u-=3}for(;n.have<19;)n.lens[O[n.have++]]=0;if(n.lencode=n.lendyn,n.lenbits=7,E={bits:n.lenbits},w=Lt(0,n.lens,0,19,n.lencode,0,n.work,E),n.lenbits=E.bits,w){e.msg=`invalid code lengths set`,n.mode=K;break}n.have=0,n.mode=dn;case dn:for(;n.have<n.nlen+n.ndist;){for(;g=n.lencode[l&(1<<n.lenbits)-1],_=g>>>24,v=g>>>16&255,y=g&65535,!(_<=u);){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}if(y<16)l>>>=_,u-=_,n.lens[n.have++]=y;else{if(y===16){for(D=_+2;u<D;){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}if(l>>>=_,u-=_,n.have===0){e.msg=`invalid bit length repeat`,n.mode=K;break}C=n.lens[n.have-1],p=3+(l&3),l>>>=2,u-=2}else if(y===17){for(D=_+3;u<D;){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}l>>>=_,u-=_,C=0,p=3+(l&7),l>>>=3,u-=3}else{for(D=_+7;u<D;){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}l>>>=_,u-=_,C=0,p=11+(l&127),l>>>=7,u-=7}if(n.have+p>n.nlen+n.ndist){e.msg=`invalid bit length repeat`,n.mode=K;break}for(;p--;)n.lens[n.have++]=C}}if(n.mode===K)break;if(n.lens[256]===0){e.msg=`invalid code -- missing end-of-block`,n.mode=K;break}if(n.lenbits=9,E={bits:n.lenbits},w=Lt(1,n.lens,0,n.nlen,n.lencode,0,n.work,E),n.lenbits=E.bits,w){e.msg=`invalid literal/lengths set`,n.mode=K;break}if(n.distbits=6,n.distcode=n.distdyn,E={bits:n.distbits},w=Lt(2,n.lens,n.nlen,n.ndist,n.distcode,0,n.work,E),n.distbits=E.bits,w){e.msg=`invalid distances set`,n.mode=K;break}if(n.mode=fn,t===Bt)break inf_leave;case fn:n.mode=pn;case pn:if(s>=6&&c>=258){e.next_out=o,e.avail_out=c,e.next_in=a,e.avail_in=s,n.hold=l,n.bits=u,Mt(e,f),o=e.next_out,i=e.output,c=e.avail_out,a=e.next_in,r=e.input,s=e.avail_in,l=n.hold,u=n.bits,n.mode===G&&(n.back=-1);break}for(n.back=0;g=n.lencode[l&(1<<n.lenbits)-1],_=g>>>24,v=g>>>16&255,y=g&65535,!(_<=u);){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}if(v&&!(v&240)){for(b=_,x=v,S=y;g=n.lencode[S+((l&(1<<b+x)-1)>>b)],_=g>>>24,v=g>>>16&255,y=g&65535,!(b+_<=u);){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}l>>>=b,u-=b,n.back+=b}if(l>>>=_,u-=_,n.back+=_,n.length=y,v===0){n.mode=vn;break}if(v&32){n.back=-1,n.mode=G;break}if(v&64){e.msg=`invalid literal/length code`,n.mode=K;break}n.extra=v&15,n.mode=mn;case mn:if(n.extra){for(D=n.extra;u<D;){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}n.length+=l&(1<<n.extra)-1,l>>>=n.extra,u-=n.extra,n.back+=n.extra}n.was=n.length,n.mode=hn;case hn:for(;g=n.distcode[l&(1<<n.distbits)-1],_=g>>>24,v=g>>>16&255,y=g&65535,!(_<=u);){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}if(!(v&240)){for(b=_,x=v,S=y;g=n.distcode[S+((l&(1<<b+x)-1)>>b)],_=g>>>24,v=g>>>16&255,y=g&65535,!(b+_<=u);){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}l>>>=b,u-=b,n.back+=b}if(l>>>=_,u-=_,n.back+=_,v&64){e.msg=`invalid distance code`,n.mode=K;break}n.offset=y,n.extra=v&15,n.mode=gn;case gn:if(n.extra){for(D=n.extra;u<D;){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}n.offset+=l&(1<<n.extra)-1,l>>>=n.extra,u-=n.extra,n.back+=n.extra}if(n.offset>n.dmax){e.msg=`invalid distance too far back`,n.mode=K;break}n.mode=_n;case _n:if(c===0)break inf_leave;if(p=f-c,n.offset>p){if(p=n.offset-p,p>n.whave&&n.sane){e.msg=`invalid distance too far back`,n.mode=K;break}p>n.wnext?(p-=n.wnext,m=n.wsize-p):m=n.wnext-p,p>n.length&&(p=n.length),h=n.window}else h=i,m=o-n.offset,p=n.length;p>c&&(p=c),c-=p,n.length-=p;do i[o++]=h[m++];while(--p);n.length===0&&(n.mode=pn);break;case vn:if(c===0)break inf_leave;i[o++]=n.length,c--,n.mode=pn;break;case yn:if(n.wrap){for(;u<32;){if(s===0)break inf_leave;s--,l|=r[a++]<<u,u+=8}if(f-=c,e.total_out+=f,n.total+=f,n.wrap&4&&f&&(e.adler=n.check=n.flags?k(n.check,i,f,o-f):be(n.check,i,f,o-f)),f=c,n.wrap&4&&(n.flags?l:wn(l))!==n.check){e.msg=`incorrect data check`,n.mode=K;break}l=0,u=0}n.mode=bn;case bn:if(n.wrap&&n.flags){for(;u<32;){if(s===0)break inf_leave;s--,l+=r[a++]<<u,u+=8}if(n.wrap&4&&l!==(n.total&4294967295)){e.msg=`incorrect length check`,n.mode=K;break}l=0,u=0}n.mode=xn;case xn:w=Vt;break inf_leave;case K:w=Ut;break inf_leave;case Sn:return Wt;case Cn:default:return W}return e.next_out=o,e.avail_out=c,e.next_in=a,e.avail_in=s,n.hold=l,n.bits=u,(n.wsize||f!==e.avail_out&&n.mode<K&&(n.mode<yn||t!==Rt))&&Fn(e,e.output,e.next_out,f-e.avail_out),d-=e.avail_in,f-=e.avail_out,e.total_in+=d,e.total_out+=f,n.total+=f,n.wrap&4&&f&&(e.adler=n.check=n.flags?k(n.check,i,f,e.next_out-f):be(n.check,i,f,e.next_out-f)),e.data_type=n.bits+(n.last?64:0)+(n.mode===G?128:0)+(n.mode===fn||n.mode===sn?256:0),(d===0&&f===0||t===Rt)&&w===U&&(w=Gt),w},inflateEnd:e=>{if(q(e))return W;let t=e.state;return t.window&&=null,e.state=null,U},inflateGetHeader:(e,t)=>{if(q(e))return W;let n=e.state;return n.wrap&2?(n.head=t,t.done=!1,U):W},inflateSetDictionary:(e,t)=>{let n=t.length,r,i,a;return q(e)||(r=e.state,r.wrap!==0&&r.mode!==rn)?W:r.mode===rn&&(i=1,i=be(i,t,n,0),i!==r.check)?Ut:(a=Fn(e,t,n,n),a?(r.mode=Sn,Wt):(r.havedict=1,U))},inflateInfo:`pako inflate (from Nodeca project)`};function In(){this.text=0,this.time=0,this.xflags=0,this.os=0,this.extra=null,this.extra_len=0,this.name=``,this.comment=``,this.hcrc=0,this.done=!1}var Ln=In;let Rn=Object.prototype.toString,{Z_NO_FLUSH:zn,Z_FINISH:Bn,Z_OK:Vn,Z_STREAM_END:Hn,Z_NEED_DICT:Un,Z_STREAM_ERROR:Wn,Z_DATA_ERROR:Gn,Z_MEM_ERROR:Kn}=A;function qn(e){this.options=ct.assign({chunkSize:1024*64,windowBits:15,to:``},e||{});let t=this.options;t.raw&&t.windowBits>=0&&t.windowBits<16&&(t.windowBits=-t.windowBits,t.windowBits===0&&(t.windowBits=-15)),t.windowBits>=0&&t.windowBits<16&&!(e&&e.windowBits)&&(t.windowBits+=32),t.windowBits>15&&t.windowBits<48&&(t.windowBits&15||(t.windowBits|=15)),this.err=0,this.msg=``,this.ended=!1,this.chunks=[],this.strm=new ht,this.strm.avail_out=0;let n=J.inflateInit2(this.strm,t.windowBits);if(n!==Vn||(this.header=new Ln,J.inflateGetHeader(this.strm,this.header),t.dictionary&&(typeof t.dictionary==`string`?t.dictionary=pt.string2buf(t.dictionary):Rn.call(t.dictionary)===`[object ArrayBuffer]`&&(t.dictionary=new Uint8Array(t.dictionary)),t.raw&&(n=J.inflateSetDictionary(this.strm,t.dictionary),n!==Vn))))throw Error(Se[n])}qn.prototype.push=function(e,t){let n=this.strm,r=this.options.chunkSize,i=this.options.dictionary,a,o,s;if(this.ended)return!1;for(o=t===~~t?t:t===!0?Bn:zn,Rn.call(e)===`[object ArrayBuffer]`?n.input=new Uint8Array(e):n.input=e,n.next_in=0,n.avail_in=n.input.length;;){for(n.avail_out===0&&(n.output=new Uint8Array(r),n.next_out=0,n.avail_out=r),a=J.inflate(n,o),a===Un&&i&&(a=J.inflateSetDictionary(n,i),a===Vn?a=J.inflate(n,o):a===Gn&&(a=Un));n.avail_in>0&&a===Hn&&n.state.wrap>0&&e[n.next_in]!==0;)J.inflateReset(n),a=J.inflate(n,o);switch(a){case Wn:case Gn:case Un:case Kn:return this.onEnd(a),this.ended=!0,!1}if(s=n.avail_out,n.next_out&&(n.avail_out===0||a===Hn))if(this.options.to===`string`){let e=pt.utf8border(n.output,n.next_out),t=n.next_out-e,i=pt.buf2string(n.output,e);n.next_out=t,n.avail_out=r-t,t&&n.output.set(n.output.subarray(e,e+t),0),this.onData(i)}else this.onData(n.output.length===n.next_out?n.output:n.output.subarray(0,n.next_out));if(!(a===Vn&&s===0)){if(a===Hn)return a=J.inflateEnd(this.strm),this.onEnd(a),this.ended=!0,!0;if(n.avail_in===0)break}}return!0},qn.prototype.onData=function(e){this.chunks.push(e)},qn.prototype.onEnd=function(e){e===Vn&&(this.options.to===`string`?this.result=this.chunks.join(``):this.result=ct.flattenChunks(this.chunks)),this.chunks=[],this.err=e,this.msg=this.strm.msg};function Jn(e,t){let n=new qn(t);if(n.push(e),n.err)throw n.msg||Se[n.err];return n.result}function Yn(e,t){return t||={},t.raw=!0,Jn(e,t)}var Xn={Inflate:qn,inflate:Jn,inflateRaw:Yn,ungzip:Jn,constants:A};let{Deflate:Zn,deflate:Qn,deflateRaw:$n,gzip:er}=At,{Inflate:tr,inflate:nr,inflateRaw:rr,ungzip:ir}=Xn;var ar=nr,or=o(((e,t)=>{t.exports=n;function n(e,t){for(var n=Array(arguments.length-1),r=0,i=2,a=!0;i<arguments.length;)n[r++]=arguments[i++];return new Promise(function(i,o){n[r]=function(e){if(a)if(a=!1,e)o(e);else{for(var t=Array(arguments.length-1),n=0;n<t.length;)t[n++]=arguments[n];i.apply(null,t)}};try{e.apply(t||null,n)}catch(e){a&&(a=!1,o(e))}})}})),sr=o((e=>{var t=e;t.length=function(e){var t=e.length;if(!t)return 0;for(;t>0&&e.charAt(t-1)===`=`;)--t;return Math.floor(t*3/4)};for(var n=Array(64),r=Array(123),i=0;i<64;)r[n[i]=i<26?i+65:i<52?i+71:i<62?i-4:i-59|43]=i++;r[45]=62,r[95]=63,t.encode=function(e,t,r){for(var i=null,a=[],o=0,s=0,c;t<r;){var l=e[t++];switch(s){case 0:a[o++]=n[l>>2],c=(l&3)<<4,s=1;break;case 1:a[o++]=n[c|l>>4],c=(l&15)<<2,s=2;break;case 2:a[o++]=n[c|l>>6],a[o++]=n[l&63],s=0;break}o>8191&&((i||=[]).push(String.fromCharCode.apply(String,a)),o=0)}return s&&(a[o++]=n[c],a[o++]=61,s===1&&(a[o++]=61)),i?(o&&i.push(String.fromCharCode.apply(String,a.slice(0,o))),i.join(``)):String.fromCharCode.apply(String,a.slice(0,o))};var a=`invalid encoding`;t.decode=function(e,t,n){for(var i=n,o=0,s,c=0;c<e.length;){var l=e.charCodeAt(c++);if(l===61&&o>1)break;if((l=r[l])===void 0)throw Error(a);switch(o){case 0:s=l,o=1;break;case 1:t[n++]=s<<2|(l&48)>>4,s=l,o=2;break;case 2:t[n++]=(s&15)<<4|(l&60)>>2,s=l,o=3;break;case 3:t[n++]=(s&3)<<6|l,o=0;break}}if(o===1)throw Error(a);return n-i};var o=/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,s=/[-_]/,c=/^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2}(?:==)?|[A-Za-z0-9_-]{3}=?)?$/;t.test=function(e){return o.test(e)||s.test(e)&&c.test(e)}})),cr=o(((e,t)=>{t.exports=n;function n(){this._listeners={}}n.prototype.on=function(e,t,n){return(this._listeners[e]||(this._listeners[e]=[])).push({fn:t,ctx:n||this}),this},n.prototype.off=function(e,t){if(e===void 0)this._listeners={};else if(t===void 0)this._listeners[e]=[];else for(var n=this._listeners[e],r=0;r<n.length;)n[r].fn===t?n.splice(r,1):++r;return this},n.prototype.emit=function(e){var t=this._listeners[e];if(t){for(var n=[],r=1;r<arguments.length;)n.push(arguments[r++]);for(r=0;r<t.length;)t[r].fn.apply(t[r++].ctx,n)}return this}})),lr=o(((e,t)=>{t.exports=n(n);function n(e){return typeof Float32Array<`u`?(function(){var t=new Float32Array([-0]),n=new Uint8Array(t.buffer),r=n[3]===128;function i(e,r,i){t[0]=e,r[i]=n[0],r[i+1]=n[1],r[i+2]=n[2],r[i+3]=n[3]}function a(e,r,i){t[0]=e,r[i]=n[3],r[i+1]=n[2],r[i+2]=n[1],r[i+3]=n[0]}e.writeFloatLE=r?i:a,e.writeFloatBE=r?a:i;function o(e,r){return n[0]=e[r],n[1]=e[r+1],n[2]=e[r+2],n[3]=e[r+3],t[0]}function s(e,r){return n[3]=e[r],n[2]=e[r+1],n[1]=e[r+2],n[0]=e[r+3],t[0]}e.readFloatLE=r?o:s,e.readFloatBE=r?s:o})():(function(){function t(e,t,n,r){var i=+(t<0);if(i&&(t=-t),t===0)e(1/t>0?0:2147483648,n,r);else if(isNaN(t))e(2143289344,n,r);else if(t>34028234663852886e22)e((i<<31|2139095040)>>>0,n,r);else if(t<11754943508222875e-54)e((i<<31|Math.round(t/1401298464324817e-60))>>>0,n,r);else{var a=Math.floor(Math.log(t)/Math.LN2),o=Math.round(t*2**-a*8388608)&8388607;e((i<<31|a+127<<23|o)>>>0,n,r)}}e.writeFloatLE=t.bind(null,r),e.writeFloatBE=t.bind(null,i);function n(e,t,n){var r=e(t,n),i=(r>>31)*2+1,a=r>>>23&255,o=r&8388607;return a===255?o?NaN:i*(1/0):a===0?i*1401298464324817e-60*o:i*2**(a-150)*(o+8388608)}e.readFloatLE=n.bind(null,a),e.readFloatBE=n.bind(null,o)})(),typeof Float64Array<`u`?(function(){var t=new Float64Array([-0]),n=new Uint8Array(t.buffer),r=n[7]===128;function i(e,r,i){t[0]=e,r[i]=n[0],r[i+1]=n[1],r[i+2]=n[2],r[i+3]=n[3],r[i+4]=n[4],r[i+5]=n[5],r[i+6]=n[6],r[i+7]=n[7]}function a(e,r,i){t[0]=e,r[i]=n[7],r[i+1]=n[6],r[i+2]=n[5],r[i+3]=n[4],r[i+4]=n[3],r[i+5]=n[2],r[i+6]=n[1],r[i+7]=n[0]}e.writeDoubleLE=r?i:a,e.writeDoubleBE=r?a:i;function o(e,r){return n[0]=e[r],n[1]=e[r+1],n[2]=e[r+2],n[3]=e[r+3],n[4]=e[r+4],n[5]=e[r+5],n[6]=e[r+6],n[7]=e[r+7],t[0]}function s(e,r){return n[7]=e[r],n[6]=e[r+1],n[5]=e[r+2],n[4]=e[r+3],n[3]=e[r+4],n[2]=e[r+5],n[1]=e[r+6],n[0]=e[r+7],t[0]}e.readDoubleLE=r?o:s,e.readDoubleBE=r?s:o})():(function(){function t(e,t,n,r,i,a){var o=+(r<0);if(o&&(r=-r),r===0)e(0,i,a+t),e(1/r>0?0:2147483648,i,a+n);else if(isNaN(r))e(0,i,a+t),e(2146959360,i,a+n);else if(r>17976931348623157e292)e(0,i,a+t),e((o<<31|2146435072)>>>0,i,a+n);else{var s;if(r<22250738585072014e-324)s=r/5e-324,e(s>>>0,i,a+t),e((o<<31|s/4294967296)>>>0,i,a+n);else{var c=Math.floor(Math.log(r)/Math.LN2);c===1024&&(c=1023),s=r*2**-c,e(s*4503599627370496>>>0,i,a+t),e((o<<31|c+1023<<20|s*1048576&1048575)>>>0,i,a+n)}}}e.writeDoubleLE=t.bind(null,r,0,4),e.writeDoubleBE=t.bind(null,i,4,0);function n(e,t,n,r,i){var a=e(r,i+t),o=e(r,i+n),s=(o>>31)*2+1,c=o>>>20&2047,l=4294967296*(o&1048575)+a;return c===2047?l?NaN:s*(1/0):c===0?s*5e-324*l:s*2**(c-1075)*(l+4503599627370496)}e.readDoubleLE=n.bind(null,a,0,4),e.readDoubleBE=n.bind(null,o,4,0)})(),e}function r(e,t,n){t[n]=e&255,t[n+1]=e>>>8&255,t[n+2]=e>>>16&255,t[n+3]=e>>>24}function i(e,t,n){t[n]=e>>>24,t[n+1]=e>>>16&255,t[n+2]=e>>>8&255,t[n+3]=e&255}function a(e,t){return(e[t]|e[t+1]<<8|e[t+2]<<16|e[t+3]<<24)>>>0}function o(e,t){return(e[t]<<24|e[t+1]<<16|e[t+2]<<8|e[t+3])>>>0}})),ur=o(((e,t)=>{t.exports=n;function n(e){try{if(typeof require!=`function`)return null;var t=require(e);return t&&(t.length||Object.keys(t).length)?t:null}catch{return null}}})),dr=o((e=>{var t=e,n=`�`;t.length=function(e){for(var t=0,n=0,r=0;r<e.length;++r)n=e.charCodeAt(r),n<128?t+=1:n<2048?t+=2:(n&64512)==55296&&(e.charCodeAt(r+1)&64512)==56320?(++r,t+=4):t+=3;return t},t.read=function(e,t,r){if(r-t<1)return``;for(var i=``,a=t;a<r;){var o=e[a++];if(o<=127)i+=String.fromCharCode(o);else if(o>=192&&o<224){var s=(o&31)<<6|e[a++]&63;i+=s>=128?String.fromCharCode(s):n}else if(o>=224&&o<240){var c=(o&15)<<12|(e[a++]&63)<<6|e[a++]&63;i+=c>=2048?String.fromCharCode(c):n}else if(o>=240){var l=(o&7)<<18|(e[a++]&63)<<12|(e[a++]&63)<<6|e[a++]&63;l<65536||l>1114111?i+=n:(l-=65536,i+=String.fromCharCode(55296+(l>>10)),i+=String.fromCharCode(56320+(l&1023)))}}return i},t.write=function(e,t,n){for(var r=n,i,a,o=0;o<e.length;++o)i=e.charCodeAt(o),i<128?t[n++]=i:i<2048?(t[n++]=i>>6|192,t[n++]=i&63|128):(i&64512)==55296&&((a=e.charCodeAt(o+1))&64512)==56320?(i=65536+((i&1023)<<10)+(a&1023),++o,t[n++]=i>>18|240,t[n++]=i>>12&63|128,t[n++]=i>>6&63|128,t[n++]=i&63|128):(t[n++]=i>>12|224,t[n++]=i>>6&63|128,t[n++]=i&63|128);return n-r}})),fr=o(((e,t)=>{t.exports=n;function n(e,t,n){var r=n||8192,i=r>>>1,a=null,o=r;return function(n){if(n<1||n>i)return e(n);o+n>r&&(a=e(r),o=0);var s=t.call(a,o,o+=n);return o&7&&(o=(o|7)+1),s}}})),pr=o(((e,t)=>{t.exports=r;var n=Y();function r(e,t){this.lo=e>>>0,this.hi=t>>>0}var i=r.zero=new r(0,0);i.toNumber=function(){return 0},i.zzEncode=i.zzDecode=function(){return this},i.length=function(){return 1};var a=r.zeroHash=`\\0\\0\\0\\0\\0\\0\\0\\0`;r.fromNumber=function(e){if(e===0)return i;var t=e<0;t&&(e=-e);var n=e>>>0,a=(e-n)/4294967296>>>0;return t&&(a=~a>>>0,n=~n>>>0,++n>4294967295&&(n=0,++a>4294967295&&(a=0))),new r(n,a)},r.from=function(e){if(typeof e==`number`)return r.fromNumber(e);if(n.isString(e))if(n.Long)e=n.Long.fromString(e);else return r.fromNumber(parseInt(e,10));return e.low||e.high?new r(e.low>>>0,e.high>>>0):i},r.prototype.toNumber=function(e){if(!e&&this.hi>>>31){var t=~this.lo+1>>>0,n=~this.hi>>>0;return t||(n=n+1>>>0),-(t+n*4294967296)}return this.lo+this.hi*4294967296},r.prototype.toLong=function(e){return n.Long?new n.Long(this.lo|0,this.hi|0,!!e):{low:this.lo|0,high:this.hi|0,unsigned:!!e}};var o=String.prototype.charCodeAt;r.fromHash=function(e){return e===a?i:new r((o.call(e,0)|o.call(e,1)<<8|o.call(e,2)<<16|o.call(e,3)<<24)>>>0,(o.call(e,4)|o.call(e,5)<<8|o.call(e,6)<<16|o.call(e,7)<<24)>>>0)},r.prototype.toHash=function(){return String.fromCharCode(this.lo&255,this.lo>>>8&255,this.lo>>>16&255,this.lo>>>24,this.hi&255,this.hi>>>8&255,this.hi>>>16&255,this.hi>>>24)},r.prototype.zzEncode=function(){var e=this.hi>>31;return this.hi=((this.hi<<1|this.lo>>>31)^e)>>>0,this.lo=(this.lo<<1^e)>>>0,this},r.prototype.zzDecode=function(){var e=-(this.lo&1);return this.lo=((this.lo>>>1|this.hi<<31)^e)>>>0,this.hi=(this.hi>>>1^e)>>>0,this},r.prototype.length=function(){var e=this.lo,t=(this.lo>>>28|this.hi<<4)>>>0,n=this.hi>>>24;return n===0?t===0?e<16384?e<128?1:2:e<2097152?3:4:t<16384?t<128?5:6:t<2097152?7:8:n<128?9:10}})),mr=o(((e,t)=>{(function(n,r){function i(e){return e.default||e}typeof define==`function`&&define.amd?define([],function(){var e={};return r(e),i(e)}):typeof e==`object`?(r(e),typeof t==`object`&&(t.exports=i(e))):(function(){var e={};r(e),n.Long=i(e)})()})(typeof globalThis<`u`?globalThis:typeof self<`u`?self:e,function(e){\"use strict\";Object.defineProperty(e,`__esModule`,{value:!0}),e.default=void 0;\n/**\n* @license\n* Copyright 2009 The Closure Library Authors\n* Copyright 2020 Daniel Wirtz / The long.js Authors.\n*\n* Licensed under the Apache License, Version 2.0 (the \"License\");\n* you may not use this file except in compliance with the License.\n* You may obtain a copy of the License at\n*\n*     http://www.apache.org/licenses/LICENSE-2.0\n*\n* Unless required by applicable law or agreed to in writing, software\n* distributed under the License is distributed on an \"AS IS\" BASIS,\n* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n* See the License for the specific language governing permissions and\n* limitations under the License.\n*\n* SPDX-License-Identifier: Apache-2.0\n*/\nvar t=null;try{t=new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0,1,13,2,96,0,1,127,96,4,127,127,127,127,1,127,3,7,6,0,1,1,1,1,1,6,6,1,127,1,65,0,11,7,50,6,3,109,117,108,0,1,5,100,105,118,95,115,0,2,5,100,105,118,95,117,0,3,5,114,101,109,95,115,0,4,5,114,101,109,95,117,0,5,8,103,101,116,95,104,105,103,104,0,0,10,191,1,6,4,0,35,0,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,126,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,127,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,128,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,129,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,130,34,4,66,32,135,167,36,0,32,4,167,11])),{}).exports}catch{}function n(e,t,n){this.low=e|0,this.high=t|0,this.unsigned=!!n}n.prototype.__isLong__,Object.defineProperty(n.prototype,`__isLong__`,{value:!0});function r(e){return(e&&e.__isLong__)===!0}function i(e){var t=Math.clz32(e&-e);return e?31-t:t}n.isLong=r;var a={},o={};function s(e,t){var n,r,i;return t?(e>>>=0,(i=0<=e&&e<256)&&(r=o[e],r)?r:(n=l(e,0,!0),i&&(o[e]=n),n)):(e|=0,(i=-128<=e&&e<128)&&(r=a[e],r)?r:(n=l(e,e<0?-1:0,!1),i&&(a[e]=n),n))}n.fromInt=s;function c(e,t){if(isNaN(e))return t?b:y;if(t){if(e<0)return b;if(e>=g)return T}else{if(e<=-_)return E;if(e+1>=_)return w}return e<0?c(-e,t).neg():l(e%h|0,e/h|0,t)}n.fromNumber=c;function l(e,t,r){return new n(e,t,r)}n.fromBits=l;var u=Math.pow;function d(e,t,n){if(e.length===0)throw Error(`empty string`);if(typeof t==`number`?(n=t,t=!1):t=!!t,e===`NaN`||e===`Infinity`||e===`+Infinity`||e===`-Infinity`)return t?b:y;if(n||=10,n<2||36<n)throw RangeError(`radix`);var r;if((r=e.indexOf(`-`))>0)throw Error(`interior hyphen`);if(r===0)return d(e.substring(1),t,n).neg();for(var i=c(u(n,8)),a=y,o=0;o<e.length;o+=8){var s=Math.min(8,e.length-o),l=parseInt(e.substring(o,o+s),n);if(s<8){var f=c(u(n,s));a=a.mul(f).add(c(l))}else a=a.mul(i),a=a.add(c(l))}return a.unsigned=t,a}n.fromString=d;function f(e,t){return typeof e==`number`?c(e,t):typeof e==`string`?d(e,t):l(e.low,e.high,typeof t==`boolean`?t:e.unsigned)}n.fromValue=f;var p=65536,m=1<<24,h=p*p,g=h*h,_=g/2,v=s(m),y=s(0);n.ZERO=y;var b=s(0,!0);n.UZERO=b;var x=s(1);n.ONE=x;var S=s(1,!0);n.UONE=S;var C=s(-1);n.NEG_ONE=C;var w=l(-1,2147483647,!1);n.MAX_VALUE=w;var T=l(-1,-1,!0);n.MAX_UNSIGNED_VALUE=T;var E=l(0,-2147483648,!1);n.MIN_VALUE=E;var D=n.prototype;D.toInt=function(){return this.unsigned?this.low>>>0:this.low},D.toNumber=function(){return this.unsigned?(this.high>>>0)*h+(this.low>>>0):this.high*h+(this.low>>>0)},D.toString=function(e){if(e||=10,e<2||36<e)throw RangeError(`radix`);if(this.isZero())return`0`;if(this.isNegative())if(this.eq(E)){var t=c(e),n=this.div(t),r=n.mul(t).sub(this);return n.toString(e)+r.toInt().toString(e)}else return`-`+this.neg().toString(e);for(var i=c(u(e,6),this.unsigned),a=this,o=``;;){var s=a.div(i),l=(a.sub(s.mul(i)).toInt()>>>0).toString(e);if(a=s,a.isZero())return l+o;for(;l.length<6;)l=`0`+l;o=``+l+o}},D.getHighBits=function(){return this.high},D.getHighBitsUnsigned=function(){return this.high>>>0},D.getLowBits=function(){return this.low},D.getLowBitsUnsigned=function(){return this.low>>>0},D.getNumBitsAbs=function(){if(this.isNegative())return this.eq(E)?64:this.neg().getNumBitsAbs();for(var e=this.high==0?this.low:this.high,t=31;t>0&&!(e&1<<t);t--);return this.high==0?t+1:t+33},D.isSafeInteger=function(){var e=this.high>>21;return e?this.unsigned?!1:e===-1&&!(this.low===0&&this.high===-2097152):!0},D.isZero=function(){return this.high===0&&this.low===0},D.eqz=D.isZero,D.isNegative=function(){return!this.unsigned&&this.high<0},D.isPositive=function(){return this.unsigned||this.high>=0},D.isOdd=function(){return(this.low&1)==1},D.isEven=function(){return(this.low&1)==0},D.equals=function(e){return r(e)||(e=f(e)),this.unsigned!==e.unsigned&&this.high>>>31==1&&e.high>>>31==1?!1:this.high===e.high&&this.low===e.low},D.eq=D.equals,D.notEquals=function(e){return!this.eq(e)},D.neq=D.notEquals,D.ne=D.notEquals,D.lessThan=function(e){return this.comp(e)<0},D.lt=D.lessThan,D.lessThanOrEqual=function(e){return this.comp(e)<=0},D.lte=D.lessThanOrEqual,D.le=D.lessThanOrEqual,D.greaterThan=function(e){return this.comp(e)>0},D.gt=D.greaterThan,D.greaterThanOrEqual=function(e){return this.comp(e)>=0},D.gte=D.greaterThanOrEqual,D.ge=D.greaterThanOrEqual,D.compare=function(e){if(r(e)||(e=f(e)),this.eq(e))return 0;var t=this.isNegative(),n=e.isNegative();return t&&!n?-1:!t&&n?1:this.unsigned?e.high>>>0>this.high>>>0||e.high===this.high&&e.low>>>0>this.low>>>0?-1:1:this.sub(e).isNegative()?-1:1},D.comp=D.compare,D.negate=function(){return!this.unsigned&&this.eq(E)?E:this.not().add(x)},D.neg=D.negate,D.add=function(e){r(e)||(e=f(e));var t=this.high>>>16,n=this.high&65535,i=this.low>>>16,a=this.low&65535,o=e.high>>>16,s=e.high&65535,c=e.low>>>16,u=e.low&65535,d=0,p=0,m=0,h=0;return h+=a+u,m+=h>>>16,h&=65535,m+=i+c,p+=m>>>16,m&=65535,p+=n+s,d+=p>>>16,p&=65535,d+=t+o,d&=65535,l(m<<16|h,d<<16|p,this.unsigned)},D.subtract=function(e){return r(e)||(e=f(e)),this.add(e.neg())},D.sub=D.subtract,D.multiply=function(e){if(this.isZero())return this;if(r(e)||(e=f(e)),t)return l(t.mul(this.low,this.high,e.low,e.high),t.get_high(),this.unsigned);if(e.isZero())return this.unsigned?b:y;if(this.eq(E))return e.isOdd()?E:y;if(e.eq(E))return this.isOdd()?E:y;if(this.isNegative())return e.isNegative()?this.neg().mul(e.neg()):this.neg().mul(e).neg();if(e.isNegative())return this.mul(e.neg()).neg();if(this.lt(v)&&e.lt(v))return c(this.toNumber()*e.toNumber(),this.unsigned);var n=this.high>>>16,i=this.high&65535,a=this.low>>>16,o=this.low&65535,s=e.high>>>16,u=e.high&65535,d=e.low>>>16,p=e.low&65535,m=0,h=0,g=0,_=0;return _+=o*p,g+=_>>>16,_&=65535,g+=a*p,h+=g>>>16,g&=65535,g+=o*d,h+=g>>>16,g&=65535,h+=i*p,m+=h>>>16,h&=65535,h+=a*d,m+=h>>>16,h&=65535,h+=o*u,m+=h>>>16,h&=65535,m+=n*p+i*d+a*u+o*s,m&=65535,l(g<<16|_,m<<16|h,this.unsigned)},D.mul=D.multiply,D.divide=function(e){if(r(e)||(e=f(e)),e.isZero())throw Error(`division by zero`);if(t)return!this.unsigned&&this.high===-2147483648&&e.low===-1&&e.high===-1?this:l((this.unsigned?t.div_u:t.div_s)(this.low,this.high,e.low,e.high),t.get_high(),this.unsigned);if(this.isZero())return this.unsigned?b:y;var n,i,a;if(this.unsigned){if(e.unsigned||(e=e.toUnsigned()),e.gt(this))return b;if(e.gt(this.shru(1)))return S;a=b}else{if(this.eq(E))return e.eq(x)||e.eq(C)?E:e.eq(E)?x:(n=this.shr(1).div(e).shl(1),n.eq(y)?e.isNegative()?x:C:(i=this.sub(e.mul(n)),a=n.add(i.div(e)),a));if(e.eq(E))return this.unsigned?b:y;if(this.isNegative())return e.isNegative()?this.neg().div(e.neg()):this.neg().div(e).neg();if(e.isNegative())return this.div(e.neg()).neg();a=y}for(i=this;i.gte(e);){n=Math.max(1,Math.floor(i.toNumber()/e.toNumber()));for(var o=Math.ceil(Math.log(n)/Math.LN2),s=o<=48?1:u(2,o-48),d=c(n),p=d.mul(e);p.isNegative()||p.gt(i);)n-=s,d=c(n,this.unsigned),p=d.mul(e);d.isZero()&&(d=x),a=a.add(d),i=i.sub(p)}return a},D.div=D.divide,D.modulo=function(e){return r(e)||(e=f(e)),t?l((this.unsigned?t.rem_u:t.rem_s)(this.low,this.high,e.low,e.high),t.get_high(),this.unsigned):this.sub(this.div(e).mul(e))},D.mod=D.modulo,D.rem=D.modulo,D.not=function(){return l(~this.low,~this.high,this.unsigned)},D.countLeadingZeros=function(){return this.high?Math.clz32(this.high):Math.clz32(this.low)+32},D.clz=D.countLeadingZeros,D.countTrailingZeros=function(){return this.low?i(this.low):i(this.high)+32},D.ctz=D.countTrailingZeros,D.and=function(e){return r(e)||(e=f(e)),l(this.low&e.low,this.high&e.high,this.unsigned)},D.or=function(e){return r(e)||(e=f(e)),l(this.low|e.low,this.high|e.high,this.unsigned)},D.xor=function(e){return r(e)||(e=f(e)),l(this.low^e.low,this.high^e.high,this.unsigned)},D.shiftLeft=function(e){return r(e)&&(e=e.toInt()),(e&=63)==0?this:e<32?l(this.low<<e,this.high<<e|this.low>>>32-e,this.unsigned):l(0,this.low<<e-32,this.unsigned)},D.shl=D.shiftLeft,D.shiftRight=function(e){return r(e)&&(e=e.toInt()),(e&=63)==0?this:e<32?l(this.low>>>e|this.high<<32-e,this.high>>e,this.unsigned):l(this.high>>e-32,this.high>=0?0:-1,this.unsigned)},D.shr=D.shiftRight,D.shiftRightUnsigned=function(e){return r(e)&&(e=e.toInt()),(e&=63)==0?this:e<32?l(this.low>>>e|this.high<<32-e,this.high>>>e,this.unsigned):l(e===32?this.high:this.high>>>e-32,0,this.unsigned)},D.shru=D.shiftRightUnsigned,D.shr_u=D.shiftRightUnsigned,D.rotateLeft=function(e){var t;return r(e)&&(e=e.toInt()),(e&=63)==0?this:e===32?l(this.high,this.low,this.unsigned):e<32?(t=32-e,l(this.low<<e|this.high>>>t,this.high<<e|this.low>>>t,this.unsigned)):(e-=32,t=32-e,l(this.high<<e|this.low>>>t,this.low<<e|this.high>>>t,this.unsigned))},D.rotl=D.rotateLeft,D.rotateRight=function(e){var t;return r(e)&&(e=e.toInt()),(e&=63)==0?this:e===32?l(this.high,this.low,this.unsigned):e<32?(t=32-e,l(this.high<<t|this.low>>>e,this.low<<t|this.high>>>e,this.unsigned)):(e-=32,t=32-e,l(this.low<<t|this.high>>>e,this.high<<t|this.low>>>e,this.unsigned))},D.rotr=D.rotateRight,D.toSigned=function(){return this.unsigned?l(this.low,this.high,!1):this},D.toUnsigned=function(){return this.unsigned?this:l(this.low,this.high,!0)},D.toBytes=function(e){return e?this.toBytesLE():this.toBytesBE()},D.toBytesLE=function(){var e=this.high,t=this.low;return[t&255,t>>>8&255,t>>>16&255,t>>>24,e&255,e>>>8&255,e>>>16&255,e>>>24]},D.toBytesBE=function(){var e=this.high,t=this.low;return[e>>>24,e>>>16&255,e>>>8&255,e&255,t>>>24,t>>>16&255,t>>>8&255,t&255]},n.fromBytes=function(e,t,r){return r?n.fromBytesLE(e,t):n.fromBytesBE(e,t)},n.fromBytesLE=function(e,t){return new n(e[0]|e[1]<<8|e[2]<<16|e[3]<<24,e[4]|e[5]<<8|e[6]<<16|e[7]<<24,t)},n.fromBytesBE=function(e,t){return new n(e[4]<<24|e[5]<<16|e[6]<<8|e[7],e[0]<<24|e[1]<<16|e[2]<<8|e[3],t)},typeof BigInt==`function`&&(n.fromBigInt=function(e,t){return l(Number(BigInt.asIntN(32,e)),Number(BigInt.asIntN(32,e>>BigInt(32))),t)},n.fromValue=function(e,t){return typeof e==`bigint`?n.fromBigInt(e,t):f(e,t)},D.toBigInt=function(){var e=BigInt(this.low>>>0);return BigInt(this.unsigned?this.high>>>0:this.high)<<BigInt(32)|e}),e.default=n})})),Y=o((e=>{var t=e;t.asPromise=or(),t.base64=sr(),t.EventEmitter=cr(),t.float=lr(),t.inquire=ur(),t.utf8=dr(),t.pool=fr(),t.LongBits=pr(),t.isNode=!!(typeof global<`u`&&global&&global.process&&global.process.versions&&global.process.versions.node),t.global=t.isNode&&global||typeof window<`u`&&window||typeof self<`u`&&self||e,t.emptyArray=Object.freeze?Object.freeze([]):[],t.emptyObject=Object.freeze?Object.freeze({}):{},t.isInteger=Number.isInteger||function(e){return typeof e==`number`&&isFinite(e)&&Math.floor(e)===e},t.isString=function(e){return typeof e==`string`||e instanceof String},t.isObject=function(e){return e&&typeof e==`object`},t.isset=t.isSet=function(e,t){var n=e[t];return n!=null&&e.hasOwnProperty(t)?typeof n!=`object`||(Array.isArray(n)?n.length:Object.keys(n).length)>0:!1},t.Buffer=(function(){try{var e=t.global.Buffer;return e.prototype.utf8Write?e:null}catch{return null}})(),t._Buffer_from=null,t._Buffer_allocUnsafe=null,t.newBuffer=function(e){return typeof e==`number`?t.Buffer?t._Buffer_allocUnsafe(e):new t.Array(e):t.Buffer?t._Buffer_from(e):typeof Uint8Array>`u`?e:new Uint8Array(e)},t.Array=typeof Uint8Array<`u`?Uint8Array:Array,t.Long=t.global.dcodeIO&&t.global.dcodeIO.Long||t.global.Long||(function(){try{var e=mr();return e&&e.isLong?e:null}catch{return null}})(),t.key2Re=/^(?:true|false|0|1)$/,t.key32Re=/^-?(?:0|[1-9][0-9]*)$/,t.key64Re=/^(?:[\\x00-\\xff]{8}|-?(?:0|[1-9][0-9]*))$/,t.longToHash=function(e){return e?t.LongBits.from(e).toHash():t.LongBits.zeroHash},t.longFromHash=function(e,n){var r=t.LongBits.fromHash(e);return t.Long?t.Long.fromBits(r.lo,r.hi,n):r.toNumber(!!n)},t.longFromKey=function(e,n){return t.key64Re.test(e)&&!t.key32Re.test(e)?t.longFromHash(e,n):e},t.boolFromKey=function(e){return e===`true`||e===`1`};function n(e,t,n){for(var r=Object.keys(t),i=0;i<r.length;++i)(e[r[i]]===void 0||!n)&&r[i]!==`__proto__`&&(e[r[i]]=t[r[i]]);return e}t.merge=n,t.recursionLimit=100,t.makeProp=function(e,t,n){Object.prototype.hasOwnProperty.call(e,t)||Object.defineProperty(e,t,{enumerable:n===void 0?!0:n,configurable:!0,writable:!0})},t.lcFirst=function(e){return e.charAt(0).toLowerCase()+e.substring(1)};function r(e){function t(e,r){if(!(this instanceof t))return new t(e,r);Object.defineProperty(this,`message`,{get:function(){return e}}),Error.captureStackTrace?Error.captureStackTrace(this,t):Object.defineProperty(this,`stack`,{value:Error().stack||``}),r&&n(this,r)}return t.prototype=Object.create(Error.prototype,{constructor:{value:t,writable:!0,enumerable:!1,configurable:!0},name:{get:function(){return e},set:void 0,enumerable:!1,configurable:!0},toString:{value:function(){return this.name+`: `+this.message},writable:!0,enumerable:!1,configurable:!0}}),t}t.newError=r,t.ProtocolError=r(`ProtocolError`),t.oneOfGetter=function(e){for(var t={},n=0;n<e.length;++n)t[e[n]]=1;return function(){for(var e=Object.keys(this),n=e.length-1;n>-1;--n)if(t[e[n]]===1&&this[e[n]]!==void 0&&this[e[n]]!==null)return e[n]}},t.oneOfSetter=function(e){return function(t){for(var n=0;n<e.length;++n)e[n]!==t&&delete this[e[n]]}},t.toJSONOptions={longs:String,enums:String,bytes:String,json:!0},t._configure=function(){var e=t.Buffer;if(!e){t._Buffer_from=t._Buffer_allocUnsafe=null;return}t._Buffer_from=e.from!==Uint8Array.from&&e.from||function(t,n){return new e(t,n)},t._Buffer_allocUnsafe=e.allocUnsafe||function(t){return new e(t)}}})),hr=o(((e,t)=>{t.exports=u;var n=Y(),r,i=n.LongBits,a=n.base64,o=n.utf8;function s(e,t,n){this.fn=e,this.len=t,this.next=void 0,this.val=n}function c(){}function l(e){this.head=e.head,this.tail=e.tail,this.len=e.len,this.next=e.states}function u(){this.len=0,this.head=new s(c,0,0),this.tail=this.head,this.states=null}var d=function(){return n.Buffer?function(){return(u.create=function(){return new r})()}:function(){return new u}};u.create=d(),u.alloc=function(e){return new n.Array(e)},n.Array!==Array&&(u.alloc=n.pool(u.alloc,n.Array.prototype.subarray)),u.prototype._push=function(e,t,n){return this.tail=this.tail.next=new s(e,t,n),this.len+=t,this};function f(e,t,n){t[n]=e&255}function p(e,t,n){for(;e>127;)t[n++]=e&127|128,e>>>=7;t[n]=e}function m(e,t){this.len=e,this.next=void 0,this.val=t}m.prototype=Object.create(s.prototype),m.prototype.fn=p,u.prototype.uint32=function(e){return this.len+=(this.tail=this.tail.next=new m((e>>>=0)<128?1:e<16384?2:e<2097152?3:e<268435456?4:5,e)).len,this},u.prototype.int32=function(e){return e<0?this._push(h,10,i.fromNumber(e)):this.uint32(e)},u.prototype.sint32=function(e){return this.uint32((e<<1^e>>31)>>>0)};function h(e,t,n){for(;e.hi;)t[n++]=e.lo&127|128,e.lo=(e.lo>>>7|e.hi<<25)>>>0,e.hi>>>=7;for(;e.lo>127;)t[n++]=e.lo&127|128,e.lo>>>=7;t[n++]=e.lo}u.prototype.uint64=function(e){var t=i.from(e);return this._push(h,t.length(),t)},u.prototype.int64=u.prototype.uint64,u.prototype.sint64=function(e){var t=i.from(e).zzEncode();return this._push(h,t.length(),t)},u.prototype.bool=function(e){return this._push(f,1,+!!e)};function g(e,t,n){t[n]=e&255,t[n+1]=e>>>8&255,t[n+2]=e>>>16&255,t[n+3]=e>>>24}u.prototype.fixed32=function(e){return this._push(g,4,e>>>0)},u.prototype.sfixed32=u.prototype.fixed32,u.prototype.fixed64=function(e){var t=i.from(e);return this._push(g,4,t.lo)._push(g,4,t.hi)},u.prototype.sfixed64=u.prototype.fixed64,u.prototype.float=function(e){return this._push(n.float.writeFloatLE,4,e)},u.prototype.double=function(e){return this._push(n.float.writeDoubleLE,8,e)};var _=n.Array.prototype.set?function(e,t,n){t.set(e,n)}:function(e,t,n){for(var r=0;r<e.length;++r)t[n+r]=e[r]};u.prototype.bytes=function(e){var t=e.length>>>0;if(!t)return this._push(f,1,0);if(n.isString(e)){var r=u.alloc(t=a.length(e));a.decode(e,r,0),e=r}return this.uint32(t)._push(_,t,e)},u.prototype.raw=function(e){var t=e.length>>>0;return t?this._push(_,t,e):this},u.prototype.string=function(e){var t=o.length(e);return t?this.uint32(t)._push(o.write,t,e):this._push(f,1,0)},u.prototype.fork=function(){return this.states=new l(this),this.head=this.tail=new s(c,0,0),this.len=0,this},u.prototype.reset=function(){return this.states?(this.head=this.states.head,this.tail=this.states.tail,this.len=this.states.len,this.states=this.states.next):(this.head=this.tail=new s(c,0,0),this.len=0),this},u.prototype.ldelim=function(){var e=this.head,t=this.tail,n=this.len;return this.reset().uint32(n),n&&(this.tail.next=e.next,this.tail=t,this.len+=n),this},u.prototype.finish=function(){return this.finishInto(this.constructor.alloc(this.len),0)},u.prototype.finishInto=function(e,t){t===void 0&&(t=0);for(var n=this.head.next,r=t;n;)n.fn(n.val,e,r),r+=n.len,n=n.next;return e},u._configure=function(e){r=e,u.create=d(),r._configure()}})),gr=o(((e,t)=>{t.exports=i;var n=hr();(i.prototype=Object.create(n.prototype)).constructor=i;var r=Y();function i(){n.call(this)}i._configure=function(){i.alloc=r._Buffer_allocUnsafe,i.writeBytesBuffer=r.Buffer&&r.Buffer.prototype instanceof Uint8Array&&r.Buffer.prototype.set.name===`set`?function(e,t,n){t.set(e,n)}:function(e,t,n){if(e.copy)e.copy(t,n,0,e.length);else for(var r=0;r<e.length;)t[n++]=e[r++]}},i.prototype.bytes=function(e){r.isString(e)&&(e=r._Buffer_from(e,`base64`));var t=e.length>>>0;return this.uint32(t),t&&this._push(i.writeBytesBuffer,t,e),this},i.prototype.raw=function(e){var t=e.length>>>0;return t?this._push(i.writeBytesBuffer,t,e):this};function a(e,t,n){e.length<40?r.utf8.write(e,t,n):t.utf8Write?t.utf8Write(e,n):t.write(e,n)}i.prototype.string=function(e){var t=r.Buffer.byteLength(e);return this.uint32(t),t&&this._push(a,t,e),this},i._configure()})),_r=o(((e,t)=>{t.exports=s;var n=Y(),r,i=n.LongBits,a=n.utf8;function o(e,t){return RangeError(`index out of range: `+e.pos+` + `+(t||1)+` > `+e.len)}function s(e){this.buf=e,this.pos=0,this.len=e.length}var c=typeof Uint8Array<`u`?function(e){if(e instanceof Uint8Array||Array.isArray(e))return new s(e);throw Error(`illegal buffer`)}:function(e){if(Array.isArray(e))return new s(e);throw Error(`illegal buffer`)},l=function(){return n.Buffer?function(e){return(s.create=function(e){return n.Buffer.isBuffer(e)?new r(e):c(e)})(e)}:c};s.create=l(),s.prototype._slice=n.Array.prototype.subarray||n.Array.prototype.slice,s.prototype.raw=function(e,t){return Array.isArray(this.buf)?this.buf.slice(e,t):e===t?new this.buf.constructor(0):this._slice.call(this.buf,e,t)},s.prototype.uint32=function(){var e=this.buf,t=this.pos,n=(e[t]&127)>>>0;if(e[t++]<128||(n=(n|(e[t]&127)<<7)>>>0,e[t++]<128)||(n=(n|(e[t]&127)<<14)>>>0,e[t++]<128)||(n=(n|(e[t]&127)<<21)>>>0,e[t++]<128)||(n=(n|(e[t]&15)<<28)>>>0,e[t++]<128))return this.pos=t,n;for(var r=0;r<5;++r){if(t>=this.len)throw this.pos=t,o(this);if(e[t++]<128)return this.pos=t,n}throw this.pos=t,Error(`invalid varint encoding`)},s.prototype.tag=function(){var e=this.buf,t=this.pos,n=(e[t]&127)>>>0;if(e[t++]<128||(n=(n|(e[t]&127)<<7)>>>0,e[t++]<128)||(n=(n|(e[t]&127)<<14)>>>0,e[t++]<128)||(n=(n|(e[t]&127)<<21)>>>0,e[t++]<128))return this.pos=t,n;if(n=(n|(e[t]&15)<<28)>>>0,e[t]<128&&!(e[t]&112))return this.pos=t+1,n;throw this.pos=t+1,Error(`invalid tag encoding`)},s.prototype.int32=function(){return this.uint32()|0},s.prototype.sint32=function(){var e=this.uint32();return e>>>1^-(e&1)|0};function u(){var e=new i(0,0),t=0;if(this.len-this.pos>4){for(;t<4;++t)if(e.lo=(e.lo|(this.buf[this.pos]&127)<<t*7)>>>0,this.buf[this.pos++]<128)return e;if(e.lo=(e.lo|(this.buf[this.pos]&127)<<28)>>>0,e.hi=(e.hi|(this.buf[this.pos]&127)>>4)>>>0,this.buf[this.pos++]<128)return e;t=0}else{for(;t<3;++t){if(this.pos>=this.len)throw o(this);if(e.lo=(e.lo|(this.buf[this.pos]&127)<<t*7)>>>0,this.buf[this.pos++]<128)return e}return e.lo=(e.lo|(this.buf[this.pos++]&127)<<t*7)>>>0,e}if(this.len-this.pos>4){for(;t<5;++t)if(e.hi=(e.hi|(this.buf[this.pos]&127)<<t*7+3)>>>0,this.buf[this.pos++]<128)return e}else for(;t<5;++t){if(this.pos>=this.len)throw o(this);if(e.hi=(e.hi|(this.buf[this.pos]&127)<<t*7+3)>>>0,this.buf[this.pos++]<128)return e}throw Error(`invalid varint encoding`)}s.prototype.bool=function(){for(var e=!1,t,n=0;n<10;++n){if(this.pos>=this.len)throw o(this);if(t=this.buf[this.pos++],t&127&&(e=!0),t<128)return e}throw Error(`invalid varint encoding`)};function d(e,t){return(e[t-4]|e[t-3]<<8|e[t-2]<<16|e[t-1]<<24)>>>0}s.prototype.fixed32=function(){if(this.pos+4>this.len)throw o(this,4);return d(this.buf,this.pos+=4)},s.prototype.sfixed32=function(){if(this.pos+4>this.len)throw o(this,4);return d(this.buf,this.pos+=4)|0};function f(){if(this.pos+8>this.len)throw o(this,8);return new i(d(this.buf,this.pos+=4),d(this.buf,this.pos+=4))}s.prototype.float=function(){if(this.pos+4>this.len)throw o(this,4);var e=n.float.readFloatLE(this.buf,this.pos);return this.pos+=4,e},s.prototype.double=function(){if(this.pos+8>this.len)throw o(this,4);var e=n.float.readDoubleLE(this.buf,this.pos);return this.pos+=8,e},s.prototype.bytes=function(){var e=this.uint32(),t=this.pos,n=this.pos+e;if(n>this.len)throw o(this,e);return this.pos=n,this.raw(t,n)},s.prototype.string=function(){var e=this.uint32(),t=this.pos,n=this.pos+e;if(n>this.len)throw o(this,e);return this.pos=n,a.read(this.buf,t,n)},s.prototype.skip=function(e){if(typeof e==`number`){if(this.pos+e>this.len)throw o(this,e);this.pos+=e}else do if(this.pos>=this.len)throw o(this);while(this.buf[this.pos++]&128);return this},s.recursionLimit=n.recursionLimit,s.prototype.skipType=function(e,t,n){if(t===void 0&&(t=0),t>s.recursionLimit)throw Error(`max depth exceeded`);if(n===0)throw Error(`illegal tag: field number 0`);switch(e){case 0:this.skip();break;case 1:this.skip(8);break;case 2:this.skip(this.uint32());break;case 3:for(;;){var r=this.tag(),i=r>>>3;if(e=r&7,!i)throw Error(`illegal tag: field number 0`);if(e===4){if(n!==void 0&&i!==n)throw Error(`invalid end group tag`);break}this.skipType(e,t+1,i)}break;case 5:this.skip(4);break;default:throw Error(`invalid wire type `+e+` at offset `+this.pos)}return this},s._configure=function(e){r=e,s.create=l(),r._configure();var t=n.Long?`toLong`:`toNumber`;n.merge(s.prototype,{int64:function(){return u.call(this)[t](!1)},uint64:function(){return u.call(this)[t](!0)},sint64:function(){return u.call(this).zzDecode()[t](!1)},fixed64:function(){return f.call(this)[t](!0)},sfixed64:function(){return f.call(this)[t](!1)}})}})),vr=o(((e,t)=>{t.exports=i;var n=_r();(i.prototype=Object.create(n.prototype)).constructor=i;var r=Y();function i(e){n.call(this,e)}i._configure=function(){r.Buffer&&(i.prototype._slice=r.Buffer.prototype.slice)},i.prototype.raw=function(e,t){return e===t?r.Buffer.alloc(0):this._slice.call(this.buf,e,t)},i.prototype.string=function(){var e=this.uint32(),t=this.pos,n=this.pos+e;if(n>this.len)throw RangeError(`index out of range: `+this.pos+` + `+e+` > `+this.len);return this.pos=n,this.buf.utf8Slice?this.buf.utf8Slice(t,n):this.buf.toString(`utf-8`,t,n)},i._configure()})),yr=o(((e,t)=>{t.exports=r;var n=Y();(r.prototype=Object.create(n.EventEmitter.prototype)).constructor=r;function r(e,t,r){if(typeof e!=`function`)throw TypeError(`rpcImpl must be a function`);n.EventEmitter.call(this),this.rpcImpl=e,this.requestDelimited=!!t,this.responseDelimited=!!r}r.prototype.rpcCall=function e(t,r,i,a,o){if(!a)throw TypeError(`request must be specified`);var s=this;if(!o)return n.asPromise(e,s,t,r,i,a);if(!s.rpcImpl){setTimeout(function(){o(Error(`already ended`))},0);return}try{return s.rpcImpl(t,r[s.requestDelimited?`encodeDelimited`:`encode`](a).finish(),function(e,n){if(e)return s.emit(`error`,e,t),o(e);if(n===null){s.end(!0);return}if(!(n instanceof i))try{n=i[s.responseDelimited?`decodeDelimited`:`decode`](n)}catch(e){return s.emit(`error`,e,t),o(e)}return s.emit(`data`,n,t),o(null,n)})}catch(e){s.emit(`error`,e,t),setTimeout(function(){o(e)},0);return}},r.prototype.end=function(e){return this.rpcImpl&&(e||this.rpcImpl(null,null,null),this.rpcImpl=null,this.emit(`end`).off()),this}})),br=o((e=>{var t=e;t.Service=yr()})),xr=o(((e,t)=>{t.exports={}})),Sr=o((e=>{var t=e;t.build=`minimal`,t.Writer=hr(),t.BufferWriter=gr(),t.Reader=_r(),t.BufferReader=vr(),t.util=Y(),t.rpc=br(),t.roots=xr(),t.configure=n;function n(){t.util._configure(),t.Writer._configure(t.BufferWriter),t.Reader._configure(t.BufferReader)}n()})),Cr=c(o(((e,t)=>{t.exports=Sr()}))(),1);let X=Cr.default.Reader,Z=Cr.default.util,Q=Cr.default.roots.default||(Cr.default.roots.default={}),wr=Q.com=(()=>{let e={};return e.opensource=(function(){let e={};return e.svga=(function(){let e={};return e.MovieParams=(function(){function e(e){if(e)for(var t=Object.keys(e),n=0;n<t.length;++n)e[t[n]]!=null&&t[n]!==`__proto__`&&(this[t[n]]=e[t[n]])}return e.prototype.viewBoxWidth=0,e.prototype.viewBoxHeight=0,e.prototype.fps=0,e.prototype.frames=0,e.decode=function(e,t,n,r,i){if(e instanceof X||(e=X.create(e)),r===void 0&&(r=0),r>X.recursionLimit)throw Error(`max depth exceeded`);for(var a=t===void 0?e.len:e.pos+t,o=i||new Q.com.opensource.svga.MovieParams,s;e.pos<a;){var c=e.pos,l=e.tag();if(l===n){n=void 0;break}var u=l&7;switch(l>>>=3){case 1:if(u!==5)break;(s=e.float())===0?delete o.viewBoxWidth:o.viewBoxWidth=s;continue;case 2:if(u!==5)break;(s=e.float())===0?delete o.viewBoxHeight:o.viewBoxHeight=s;continue;case 3:if(u!==0)break;(s=e.int32())?o.fps=s:delete o.fps;continue;case 4:if(u!==0)break;(s=e.int32())?o.frames=s:delete o.frames;continue}e.skipType(u,r,l),Z.makeProp(o,`$unknowns`,!1),(o.$unknowns||=[]).push(e.raw(c,e.pos))}if(n!==void 0)throw Error(`missing end group`);return o},e.getTypeUrl=function(e){return e===void 0&&(e=`type.googleapis.com`),e+`/com.opensource.svga.MovieParams`},e})(),e.SpriteEntity=(function(){function e(e){if(this.frames=[],e)for(var t=Object.keys(e),n=0;n<t.length;++n)e[t[n]]!=null&&t[n]!==`__proto__`&&(this[t[n]]=e[t[n]])}return e.prototype.imageKey=``,e.prototype.frames=Z.emptyArray,e.prototype.matteKey=``,e.decode=function(e,t,n,r,i){if(e instanceof X||(e=X.create(e)),r===void 0&&(r=0),r>X.recursionLimit)throw Error(`max depth exceeded`);for(var a=t===void 0?e.len:e.pos+t,o=i||new Q.com.opensource.svga.SpriteEntity,s;e.pos<a;){var c=e.pos,l=e.tag();if(l===n){n=void 0;break}var u=l&7;switch(l>>>=3){case 1:if(u!==2)break;(s=e.string()).length?o.imageKey=s:delete o.imageKey;continue;case 2:if(u!==2)break;o.frames&&o.frames.length||(o.frames=[]),o.frames.push(Q.com.opensource.svga.FrameEntity.decode(e,e.uint32(),void 0,r+1));continue;case 3:if(u!==2)break;(s=e.string()).length?o.matteKey=s:delete o.matteKey;continue}e.skipType(u,r,l),Z.makeProp(o,`$unknowns`,!1),(o.$unknowns||=[]).push(e.raw(c,e.pos))}if(n!==void 0)throw Error(`missing end group`);return o},e.getTypeUrl=function(e){return e===void 0&&(e=`type.googleapis.com`),e+`/com.opensource.svga.SpriteEntity`},e})(),e.AudioEntity=(function(){function e(e){if(e)for(var t=Object.keys(e),n=0;n<t.length;++n)e[t[n]]!=null&&t[n]!==`__proto__`&&(this[t[n]]=e[t[n]])}return e.prototype.audioKey=``,e.prototype.startFrame=0,e.prototype.endFrame=0,e.prototype.startTime=0,e.prototype.totalTime=0,e.decode=function(e,t,n,r,i){if(e instanceof X||(e=X.create(e)),r===void 0&&(r=0),r>X.recursionLimit)throw Error(`max depth exceeded`);for(var a=t===void 0?e.len:e.pos+t,o=i||new Q.com.opensource.svga.AudioEntity,s;e.pos<a;){var c=e.pos,l=e.tag();if(l===n){n=void 0;break}var u=l&7;switch(l>>>=3){case 1:if(u!==2)break;(s=e.string()).length?o.audioKey=s:delete o.audioKey;continue;case 2:if(u!==0)break;(s=e.int32())?o.startFrame=s:delete o.startFrame;continue;case 3:if(u!==0)break;(s=e.int32())?o.endFrame=s:delete o.endFrame;continue;case 4:if(u!==0)break;(s=e.int32())?o.startTime=s:delete o.startTime;continue;case 5:if(u!==0)break;(s=e.int32())?o.totalTime=s:delete o.totalTime;continue}e.skipType(u,r,l),Z.makeProp(o,`$unknowns`,!1),(o.$unknowns||=[]).push(e.raw(c,e.pos))}if(n!==void 0)throw Error(`missing end group`);return o},e.getTypeUrl=function(e){return e===void 0&&(e=`type.googleapis.com`),e+`/com.opensource.svga.AudioEntity`},e})(),e.Layout=(function(){function e(e){if(e)for(var t=Object.keys(e),n=0;n<t.length;++n)e[t[n]]!=null&&t[n]!==`__proto__`&&(this[t[n]]=e[t[n]])}return e.prototype.x=0,e.prototype.y=0,e.prototype.width=0,e.prototype.height=0,e.decode=function(e,t,n,r,i){if(e instanceof X||(e=X.create(e)),r===void 0&&(r=0),r>X.recursionLimit)throw Error(`max depth exceeded`);for(var a=t===void 0?e.len:e.pos+t,o=i||new Q.com.opensource.svga.Layout,s;e.pos<a;){var c=e.pos,l=e.tag();if(l===n){n=void 0;break}var u=l&7;switch(l>>>=3){case 1:if(u!==5)break;(s=e.float())===0?delete o.x:o.x=s;continue;case 2:if(u!==5)break;(s=e.float())===0?delete o.y:o.y=s;continue;case 3:if(u!==5)break;(s=e.float())===0?delete o.width:o.width=s;continue;case 4:if(u!==5)break;(s=e.float())===0?delete o.height:o.height=s;continue}e.skipType(u,r,l),Z.makeProp(o,`$unknowns`,!1),(o.$unknowns||=[]).push(e.raw(c,e.pos))}if(n!==void 0)throw Error(`missing end group`);return o},e.getTypeUrl=function(e){return e===void 0&&(e=`type.googleapis.com`),e+`/com.opensource.svga.Layout`},e})(),e.Transform=(function(){function e(e){if(e)for(var t=Object.keys(e),n=0;n<t.length;++n)e[t[n]]!=null&&t[n]!==`__proto__`&&(this[t[n]]=e[t[n]])}return e.prototype.a=0,e.prototype.b=0,e.prototype.c=0,e.prototype.d=0,e.prototype.tx=0,e.prototype.ty=0,e.decode=function(e,t,n,r,i){if(e instanceof X||(e=X.create(e)),r===void 0&&(r=0),r>X.recursionLimit)throw Error(`max depth exceeded`);for(var a=t===void 0?e.len:e.pos+t,o=i||new Q.com.opensource.svga.Transform,s;e.pos<a;){var c=e.pos,l=e.tag();if(l===n){n=void 0;break}var u=l&7;switch(l>>>=3){case 1:if(u!==5)break;(s=e.float())===0?delete o.a:o.a=s;continue;case 2:if(u!==5)break;(s=e.float())===0?delete o.b:o.b=s;continue;case 3:if(u!==5)break;(s=e.float())===0?delete o.c:o.c=s;continue;case 4:if(u!==5)break;(s=e.float())===0?delete o.d:o.d=s;continue;case 5:if(u!==5)break;(s=e.float())===0?delete o.tx:o.tx=s;continue;case 6:if(u!==5)break;(s=e.float())===0?delete o.ty:o.ty=s;continue}e.skipType(u,r,l),Z.makeProp(o,`$unknowns`,!1),(o.$unknowns||=[]).push(e.raw(c,e.pos))}if(n!==void 0)throw Error(`missing end group`);return o},e.getTypeUrl=function(e){return e===void 0&&(e=`type.googleapis.com`),e+`/com.opensource.svga.Transform`},e})(),e.ShapeEntity=(function(){function e(e){if(e)for(var t=Object.keys(e),n=0;n<t.length;++n)e[t[n]]!=null&&t[n]!==`__proto__`&&(this[t[n]]=e[t[n]])}e.prototype.type=0,e.prototype.shape=null,e.prototype.rect=null,e.prototype.ellipse=null,e.prototype.styles=null,e.prototype.transform=null;let t;return Object.defineProperty(e.prototype,`args`,{get:Z.oneOfGetter(t=[`shape`,`rect`,`ellipse`]),set:Z.oneOfSetter(t)}),e.decode=function(e,t,n,r,i){if(e instanceof X||(e=X.create(e)),r===void 0&&(r=0),r>X.recursionLimit)throw Error(`max depth exceeded`);for(var a=t===void 0?e.len:e.pos+t,o=i||new Q.com.opensource.svga.ShapeEntity,s;e.pos<a;){var c=e.pos,l=e.tag();if(l===n){n=void 0;break}var u=l&7;switch(l>>>=3){case 1:if(u!==0)break;(s=e.int32())?o.type=s:delete o.type;continue;case 2:if(u!==2)break;o.shape=Q.com.opensource.svga.ShapeEntity.ShapeArgs.decode(e,e.uint32(),void 0,r+1,o.shape),o.args=`shape`;continue;case 3:if(u!==2)break;o.rect=Q.com.opensource.svga.ShapeEntity.RectArgs.decode(e,e.uint32(),void 0,r+1,o.rect),o.args=`rect`;continue;case 4:if(u!==2)break;o.ellipse=Q.com.opensource.svga.ShapeEntity.EllipseArgs.decode(e,e.uint32(),void 0,r+1,o.ellipse),o.args=`ellipse`;continue;case 10:if(u!==2)break;o.styles=Q.com.opensource.svga.ShapeEntity.ShapeStyle.decode(e,e.uint32(),void 0,r+1,o.styles);continue;case 11:if(u!==2)break;o.transform=Q.com.opensource.svga.Transform.decode(e,e.uint32(),void 0,r+1,o.transform);continue}e.skipType(u,r,l),Z.makeProp(o,`$unknowns`,!1),(o.$unknowns||=[]).push(e.raw(c,e.pos))}if(n!==void 0)throw Error(`missing end group`);return o},e.getTypeUrl=function(e){return e===void 0&&(e=`type.googleapis.com`),e+`/com.opensource.svga.ShapeEntity`},e.ShapeType=(function(){let e={},t=Object.create(e);return t[e[0]=`SHAPE`]=0,t[e[1]=`RECT`]=1,t[e[2]=`ELLIPSE`]=2,t[e[3]=`KEEP`]=3,t})(),e.ShapeArgs=(function(){function e(e){if(e)for(var t=Object.keys(e),n=0;n<t.length;++n)e[t[n]]!=null&&t[n]!==`__proto__`&&(this[t[n]]=e[t[n]])}return e.prototype.d=``,e.decode=function(e,t,n,r,i){if(e instanceof X||(e=X.create(e)),r===void 0&&(r=0),r>X.recursionLimit)throw Error(`max depth exceeded`);for(var a=t===void 0?e.len:e.pos+t,o=i||new Q.com.opensource.svga.ShapeEntity.ShapeArgs,s;e.pos<a;){var c=e.pos,l=e.tag();if(l===n){n=void 0;break}var u=l&7;switch(l>>>=3){case 1:if(u!==2)break;(s=e.string()).length?o.d=s:delete o.d;continue}e.skipType(u,r,l),Z.makeProp(o,`$unknowns`,!1),(o.$unknowns||=[]).push(e.raw(c,e.pos))}if(n!==void 0)throw Error(`missing end group`);return o},e.getTypeUrl=function(e){return e===void 0&&(e=`type.googleapis.com`),e+`/com.opensource.svga.ShapeEntity.ShapeArgs`},e})(),e.RectArgs=(function(){function e(e){if(e)for(var t=Object.keys(e),n=0;n<t.length;++n)e[t[n]]!=null&&t[n]!==`__proto__`&&(this[t[n]]=e[t[n]])}return e.prototype.x=0,e.prototype.y=0,e.prototype.width=0,e.prototype.height=0,e.prototype.cornerRadius=0,e.decode=function(e,t,n,r,i){if(e instanceof X||(e=X.create(e)),r===void 0&&(r=0),r>X.recursionLimit)throw Error(`max depth exceeded`);for(var a=t===void 0?e.len:e.pos+t,o=i||new Q.com.opensource.svga.ShapeEntity.RectArgs,s;e.pos<a;){var c=e.pos,l=e.tag();if(l===n){n=void 0;break}var u=l&7;switch(l>>>=3){case 1:if(u!==5)break;(s=e.float())===0?delete o.x:o.x=s;continue;case 2:if(u!==5)break;(s=e.float())===0?delete o.y:o.y=s;continue;case 3:if(u!==5)break;(s=e.float())===0?delete o.width:o.width=s;continue;case 4:if(u!==5)break;(s=e.float())===0?delete o.height:o.height=s;continue;case 5:if(u!==5)break;(s=e.float())===0?delete o.cornerRadius:o.cornerRadius=s;continue}e.skipType(u,r,l),Z.makeProp(o,`$unknowns`,!1),(o.$unknowns||=[]).push(e.raw(c,e.pos))}if(n!==void 0)throw Error(`missing end group`);return o},e.getTypeUrl=function(e){return e===void 0&&(e=`type.googleapis.com`),e+`/com.opensource.svga.ShapeEntity.RectArgs`},e})(),e.EllipseArgs=(function(){function e(e){if(e)for(var t=Object.keys(e),n=0;n<t.length;++n)e[t[n]]!=null&&t[n]!==`__proto__`&&(this[t[n]]=e[t[n]])}return e.prototype.x=0,e.prototype.y=0,e.prototype.radiusX=0,e.prototype.radiusY=0,e.decode=function(e,t,n,r,i){if(e instanceof X||(e=X.create(e)),r===void 0&&(r=0),r>X.recursionLimit)throw Error(`max depth exceeded`);for(var a=t===void 0?e.len:e.pos+t,o=i||new Q.com.opensource.svga.ShapeEntity.EllipseArgs,s;e.pos<a;){var c=e.pos,l=e.tag();if(l===n){n=void 0;break}var u=l&7;switch(l>>>=3){case 1:if(u!==5)break;(s=e.float())===0?delete o.x:o.x=s;continue;case 2:if(u!==5)break;(s=e.float())===0?delete o.y:o.y=s;continue;case 3:if(u!==5)break;(s=e.float())===0?delete o.radiusX:o.radiusX=s;continue;case 4:if(u!==5)break;(s=e.float())===0?delete o.radiusY:o.radiusY=s;continue}e.skipType(u,r,l),Z.makeProp(o,`$unknowns`,!1),(o.$unknowns||=[]).push(e.raw(c,e.pos))}if(n!==void 0)throw Error(`missing end group`);return o},e.getTypeUrl=function(e){return e===void 0&&(e=`type.googleapis.com`),e+`/com.opensource.svga.ShapeEntity.EllipseArgs`},e})(),e.ShapeStyle=(function(){function e(e){if(e)for(var t=Object.keys(e),n=0;n<t.length;++n)e[t[n]]!=null&&t[n]!==`__proto__`&&(this[t[n]]=e[t[n]])}return e.prototype.fill=null,e.prototype.stroke=null,e.prototype.strokeWidth=0,e.prototype.lineCap=0,e.prototype.lineJoin=0,e.prototype.miterLimit=0,e.prototype.lineDashI=0,e.prototype.lineDashII=0,e.prototype.lineDashIII=0,e.decode=function(e,t,n,r,i){if(e instanceof X||(e=X.create(e)),r===void 0&&(r=0),r>X.recursionLimit)throw Error(`max depth exceeded`);for(var a=t===void 0?e.len:e.pos+t,o=i||new Q.com.opensource.svga.ShapeEntity.ShapeStyle,s;e.pos<a;){var c=e.pos,l=e.tag();if(l===n){n=void 0;break}var u=l&7;switch(l>>>=3){case 1:if(u!==2)break;o.fill=Q.com.opensource.svga.ShapeEntity.ShapeStyle.RGBAColor.decode(e,e.uint32(),void 0,r+1,o.fill);continue;case 2:if(u!==2)break;o.stroke=Q.com.opensource.svga.ShapeEntity.ShapeStyle.RGBAColor.decode(e,e.uint32(),void 0,r+1,o.stroke);continue;case 3:if(u!==5)break;(s=e.float())===0?delete o.strokeWidth:o.strokeWidth=s;continue;case 4:if(u!==0)break;(s=e.int32())?o.lineCap=s:delete o.lineCap;continue;case 5:if(u!==0)break;(s=e.int32())?o.lineJoin=s:delete o.lineJoin;continue;case 6:if(u!==5)break;(s=e.float())===0?delete o.miterLimit:o.miterLimit=s;continue;case 7:if(u!==5)break;(s=e.float())===0?delete o.lineDashI:o.lineDashI=s;continue;case 8:if(u!==5)break;(s=e.float())===0?delete o.lineDashII:o.lineDashII=s;continue;case 9:if(u!==5)break;(s=e.float())===0?delete o.lineDashIII:o.lineDashIII=s;continue}e.skipType(u,r,l),Z.makeProp(o,`$unknowns`,!1),(o.$unknowns||=[]).push(e.raw(c,e.pos))}if(n!==void 0)throw Error(`missing end group`);return o},e.getTypeUrl=function(e){return e===void 0&&(e=`type.googleapis.com`),e+`/com.opensource.svga.ShapeEntity.ShapeStyle`},e.RGBAColor=(function(){function e(e){if(e)for(var t=Object.keys(e),n=0;n<t.length;++n)e[t[n]]!=null&&t[n]!==`__proto__`&&(this[t[n]]=e[t[n]])}return e.prototype.r=0,e.prototype.g=0,e.prototype.b=0,e.prototype.a=0,e.decode=function(e,t,n,r,i){if(e instanceof X||(e=X.create(e)),r===void 0&&(r=0),r>X.recursionLimit)throw Error(`max depth exceeded`);for(var a=t===void 0?e.len:e.pos+t,o=i||new Q.com.opensource.svga.ShapeEntity.ShapeStyle.RGBAColor,s;e.pos<a;){var c=e.pos,l=e.tag();if(l===n){n=void 0;break}var u=l&7;switch(l>>>=3){case 1:if(u!==5)break;(s=e.float())===0?delete o.r:o.r=s;continue;case 2:if(u!==5)break;(s=e.float())===0?delete o.g:o.g=s;continue;case 3:if(u!==5)break;(s=e.float())===0?delete o.b:o.b=s;continue;case 4:if(u!==5)break;(s=e.float())===0?delete o.a:o.a=s;continue}e.skipType(u,r,l),Z.makeProp(o,`$unknowns`,!1),(o.$unknowns||=[]).push(e.raw(c,e.pos))}if(n!==void 0)throw Error(`missing end group`);return o},e.getTypeUrl=function(e){return e===void 0&&(e=`type.googleapis.com`),e+`/com.opensource.svga.ShapeEntity.ShapeStyle.RGBAColor`},e})(),e.LineCap=(function(){let e={},t=Object.create(e);return t[e[0]=`LineCap_BUTT`]=0,t[e[1]=`LineCap_ROUND`]=1,t[e[2]=`LineCap_SQUARE`]=2,t})(),e.LineJoin=(function(){let e={},t=Object.create(e);return t[e[0]=`LineJoin_MITER`]=0,t[e[1]=`LineJoin_ROUND`]=1,t[e[2]=`LineJoin_BEVEL`]=2,t})(),e})(),e})(),e.FrameEntity=(function(){function e(e){if(this.shapes=[],e)for(var t=Object.keys(e),n=0;n<t.length;++n)e[t[n]]!=null&&t[n]!==`__proto__`&&(this[t[n]]=e[t[n]])}return e.prototype.alpha=0,e.prototype.layout=null,e.prototype.transform=null,e.prototype.clipPath=``,e.prototype.shapes=Z.emptyArray,e.decode=function(e,t,n,r,i){if(e instanceof X||(e=X.create(e)),r===void 0&&(r=0),r>X.recursionLimit)throw Error(`max depth exceeded`);for(var a=t===void 0?e.len:e.pos+t,o=i||new Q.com.opensource.svga.FrameEntity,s;e.pos<a;){var c=e.pos,l=e.tag();if(l===n){n=void 0;break}var u=l&7;switch(l>>>=3){case 1:if(u!==5)break;(s=e.float())===0?delete o.alpha:o.alpha=s;continue;case 2:if(u!==2)break;o.layout=Q.com.opensource.svga.Layout.decode(e,e.uint32(),void 0,r+1,o.layout);continue;case 3:if(u!==2)break;o.transform=Q.com.opensource.svga.Transform.decode(e,e.uint32(),void 0,r+1,o.transform);continue;case 4:if(u!==2)break;(s=e.string()).length?o.clipPath=s:delete o.clipPath;continue;case 5:if(u!==2)break;o.shapes&&o.shapes.length||(o.shapes=[]),o.shapes.push(Q.com.opensource.svga.ShapeEntity.decode(e,e.uint32(),void 0,r+1));continue}e.skipType(u,r,l),Z.makeProp(o,`$unknowns`,!1),(o.$unknowns||=[]).push(e.raw(c,e.pos))}if(n!==void 0)throw Error(`missing end group`);return o},e.getTypeUrl=function(e){return e===void 0&&(e=`type.googleapis.com`),e+`/com.opensource.svga.FrameEntity`},e})(),e.MovieEntity=(function(){function e(e){if(this.images={},this.sprites=[],this.audios=[],e)for(var t=Object.keys(e),n=0;n<t.length;++n)e[t[n]]!=null&&t[n]!==`__proto__`&&(this[t[n]]=e[t[n]])}return e.prototype.version=``,e.prototype.params=null,e.prototype.images=Z.emptyObject,e.prototype.sprites=Z.emptyArray,e.prototype.audios=Z.emptyArray,e.decode=function(e,t,n,r,i){if(e instanceof X||(e=X.create(e)),r===void 0&&(r=0),r>X.recursionLimit)throw Error(`max depth exceeded`);for(var a=t===void 0?e.len:e.pos+t,o=i||new Q.com.opensource.svga.MovieEntity,s,c;e.pos<a;){var l=e.pos,u=e.tag();if(u===n){n=void 0;break}var d=u&7;switch(u>>>=3){case 1:if(d!==2)break;(c=e.string()).length?o.version=c:delete o.version;continue;case 2:if(d!==2)break;o.params=Q.com.opensource.svga.MovieParams.decode(e,e.uint32(),void 0,r+1,o.params);continue;case 3:if(d!==2)break;o.images===Z.emptyObject&&(o.images={});var f=e.uint32()+e.pos;for(s=``,c=[];e.pos<f;){var p=e.tag();switch(d=p&7,p>>>=3){case 1:if(d!==2)break;s=e.string();continue;case 2:if(d!==2)break;c=e.bytes();continue}e.skipType(d,r,p)}s===`__proto__`&&Z.makeProp(o.images,s),o.images[s]=c;continue;case 4:if(d!==2)break;o.sprites&&o.sprites.length||(o.sprites=[]),o.sprites.push(Q.com.opensource.svga.SpriteEntity.decode(e,e.uint32(),void 0,r+1));continue;case 5:if(d!==2)break;o.audios&&o.audios.length||(o.audios=[]),o.audios.push(Q.com.opensource.svga.AudioEntity.decode(e,e.uint32(),void 0,r+1));continue}e.skipType(d,r,u),Z.makeProp(o,`$unknowns`,!1),(o.$unknowns||=[]).push(e.raw(l,e.pos))}if(n!==void 0)throw Error(`missing end group`);return o},e.getTypeUrl=function(e){return e===void 0&&(e=`type.googleapis.com`),e+`/com.opensource.svga.MovieEntity`},e})(),e})(),e})(),e})();var $=wr.opensource.svga,Tr=class e{static{this.lastShapes=[]}constructor(t){if(this.shapes=[],this.alpha=t.alpha||0,this.layout={x:t.layout?.x||0,y:t.layout?.y||0,width:t.layout?.width||0,height:t.layout?.height||0},this.transform={a:t.transform?.a||1,b:t.transform?.b||0,c:t.transform?.c||0,d:t.transform?.d||1,tx:t.transform?.tx||0,ty:t.transform?.ty||0},this.clipPath=t.clipPath||null,t.shapes)if(t.shapes[0]&&t.shapes[0].type===$.ShapeEntity.ShapeType.KEEP)this.shapes=e.lastShapes;else{let n=t.shapes.map(e=>{if(Object.prototype.hasOwnProperty.call(e,`type`)||Object.defineProperty(e,`type`,{value:e.type,enumerable:!0}),e.styles){if(e.styles.fill){let{r:t,g:n,b:r,a:i}=e.styles.fill;e.styles.fillStr=`rgba(${parseInt((t*255).toString())}, ${parseInt((n*255).toString())}, ${parseInt((r*255).toString())}, ${i})`}if(e.styles.stroke){let{r:t,g:n,b:r,a:i}=e.styles.stroke;e.styles.strokeStr=`rgba(${parseInt((t*255).toString())}, ${parseInt((n*255).toString())}, ${parseInt((r*255).toString())}, ${i})`}switch(e.styles.lineJoin){case $.ShapeEntity.ShapeStyle.LineJoin.LineJoin_MITER:e.styles.lineJoinStr=`miter`;break;case $.ShapeEntity.ShapeStyle.LineJoin.LineJoin_ROUND:e.styles.lineJoinStr=`round`;break;case $.ShapeEntity.ShapeStyle.LineJoin.LineJoin_BEVEL:e.styles.lineJoinStr=`bevel`;break}switch(e.styles.lineCap){case $.ShapeEntity.ShapeStyle.LineCap.LineCap_BUTT:e.styles.lineCapStr=`butt`;break;case $.ShapeEntity.ShapeStyle.LineCap.LineCap_ROUND:e.styles.lineCapStr=`round`;break;case $.ShapeEntity.ShapeStyle.LineCap.LineCap_SQUARE:e.styles.lineCapStr=`square`;break}}return e});e.lastShapes=n,this.shapes=n}}},Er=class{constructor(e,t,n){this.videoSize={width:0,height:0},this.images={},this.audios={},this.dynamicElements={},this.sprites=[],this.version=e.version,this.videoSize.width=e.params?.viewBoxWidth||0,this.videoSize.height=e.params?.viewBoxHeight||0,this.FPS=e.params?.fps||20,this.frames=e.params?.frames||0,this.sprites=e.sprites.map(({imageKey:e=null,frames:t})=>({imageKey:e,frames:(t||[]).map(e=>new Tr(e))})),this.images=t,this.audios=n}},Dr=wr.opensource.svga,Or=function(e){return e[e.AUDIO_XMPEG=73]=`AUDIO_XMPEG`,e[e.IMAGE_PNG=137]=`IMAGE_PNG`,e}(Or||{});let kr=e=>{let t=new Uint8Array(e.byteLength);return t.set(e),t.buffer};onmessage=function(e){let t=ar(new Uint8Array(e.data.data)),n=Dr.MovieEntity.decode(t),r={},i={},a=new Set;n.audios.forEach(e=>{let{audioKey:t,endFrame:r,startFrame:o,startTime:s,totalTime:c}=e,l=n.images[t];if(!l)return;let u=kr(l);a.add(u),i[t]={audioKey:t,source:u,startFrame:o,endFrame:r,startTime:s,totalTime:c}});for(let e in n.images){let t=n.images[e];if(t[0]===Or.AUDIO_XMPEG)continue;if(t[0]!==Or.IMAGE_PNG){console.warn(`unrecognized svga image source`,t,n);continue}let i=kr(t);r[e]=i,a.add(i)}let o=new Er(n,r,i),s=Array.from(a);postMessage({result:o,id:e.data.id},s)}})();", f = typeof self < "u" && self.Blob && new Blob(["(self.URL || self.webkitURL).revokeObjectURL(self.location.href);", d], { type: "text/javascript;charset=utf-8" });
function p(e) {
	let t;
	try {
		if (t = f && (self.URL || self.webkitURL).createObjectURL(f), !t) throw "";
		let n = new Worker(t, { name: e?.name });
		return n.addEventListener("error", () => {
			(self.URL || self.webkitURL).revokeObjectURL(t);
		}), n;
	} catch {
		return new Worker("data:text/javascript;charset=utf-8," + encodeURIComponent(d), { name: e?.name });
	}
}
//#endregion
//#region src/parser/version.ts
var m = /* @__PURE__ */ function(e) {
	return e[e.VERSION_1 = 1] = "VERSION_1", e[e.VERSION_2 = 2] = "VERSION_2", e;
}({});
function h(e) {
	return e[0] == 80 && e[1] == 75 && e[2] == 3 && e[3] == 4 ? m.VERSION_1 : m.VERSION_2;
}
//#endregion
//#region node_modules/.pnpm/protobufjs@8.2.0/node_modules/protobufjs/src/util/aspromise.js
var g = /* @__PURE__ */ o(((e, t) => {
	t.exports = n;
	function n(e, t) {
		for (var n = Array(arguments.length - 1), r = 0, i = 2, a = !0; i < arguments.length;) n[r++] = arguments[i++];
		return new Promise(function(i, o) {
			n[r] = function(e) {
				if (a) if (a = !1, e) o(e);
				else {
					for (var t = Array(arguments.length - 1), n = 0; n < t.length;) t[n++] = arguments[n];
					i.apply(null, t);
				}
			};
			try {
				e.apply(t || null, n);
			} catch (e) {
				a && (a = !1, o(e));
			}
		});
	}
})), _ = /* @__PURE__ */ o(((e) => {
	var t = e;
	t.length = function(e) {
		var t = e.length;
		if (!t) return 0;
		for (; t > 0 && e.charAt(t - 1) === "=";) --t;
		return Math.floor(t * 3 / 4);
	};
	for (var n = Array(64), r = Array(123), i = 0; i < 64;) r[n[i] = i < 26 ? i + 65 : i < 52 ? i + 71 : i < 62 ? i - 4 : i - 59 | 43] = i++;
	r[45] = 62, r[95] = 63, t.encode = function(e, t, r) {
		for (var i = null, a = [], o = 0, s = 0, c; t < r;) {
			var l = e[t++];
			switch (s) {
				case 0:
					a[o++] = n[l >> 2], c = (l & 3) << 4, s = 1;
					break;
				case 1:
					a[o++] = n[c | l >> 4], c = (l & 15) << 2, s = 2;
					break;
				case 2:
					a[o++] = n[c | l >> 6], a[o++] = n[l & 63], s = 0;
					break;
			}
			o > 8191 && ((i ||= []).push(String.fromCharCode.apply(String, a)), o = 0);
		}
		return s && (a[o++] = n[c], a[o++] = 61, s === 1 && (a[o++] = 61)), i ? (o && i.push(String.fromCharCode.apply(String, a.slice(0, o))), i.join("")) : String.fromCharCode.apply(String, a.slice(0, o));
	};
	var a = "invalid encoding";
	t.decode = function(e, t, n) {
		for (var i = n, o = 0, s, c = 0; c < e.length;) {
			var l = e.charCodeAt(c++);
			if (l === 61 && o > 1) break;
			if ((l = r[l]) === void 0) throw Error(a);
			switch (o) {
				case 0:
					s = l, o = 1;
					break;
				case 1:
					t[n++] = s << 2 | (l & 48) >> 4, s = l, o = 2;
					break;
				case 2:
					t[n++] = (s & 15) << 4 | (l & 60) >> 2, s = l, o = 3;
					break;
				case 3:
					t[n++] = (s & 3) << 6 | l, o = 0;
					break;
			}
		}
		if (o === 1) throw Error(a);
		return n - i;
	};
	var o = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/, s = /[-_]/, c = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2}(?:==)?|[A-Za-z0-9_-]{3}=?)?$/;
	t.test = function(e) {
		return o.test(e) || s.test(e) && c.test(e);
	};
})), v = /* @__PURE__ */ o(((e, t) => {
	t.exports = n;
	function n() {
		this._listeners = {};
	}
	n.prototype.on = function(e, t, n) {
		return (this._listeners[e] || (this._listeners[e] = [])).push({
			fn: t,
			ctx: n || this
		}), this;
	}, n.prototype.off = function(e, t) {
		if (e === void 0) this._listeners = {};
		else if (t === void 0) this._listeners[e] = [];
		else for (var n = this._listeners[e], r = 0; r < n.length;) n[r].fn === t ? n.splice(r, 1) : ++r;
		return this;
	}, n.prototype.emit = function(e) {
		var t = this._listeners[e];
		if (t) {
			for (var n = [], r = 1; r < arguments.length;) n.push(arguments[r++]);
			for (r = 0; r < t.length;) t[r].fn.apply(t[r++].ctx, n);
		}
		return this;
	};
})), y = /* @__PURE__ */ o(((e, t) => {
	t.exports = n(n);
	function n(e) {
		return typeof Float32Array < "u" ? (function() {
			var t = new Float32Array([-0]), n = new Uint8Array(t.buffer), r = n[3] === 128;
			function i(e, r, i) {
				t[0] = e, r[i] = n[0], r[i + 1] = n[1], r[i + 2] = n[2], r[i + 3] = n[3];
			}
			function a(e, r, i) {
				t[0] = e, r[i] = n[3], r[i + 1] = n[2], r[i + 2] = n[1], r[i + 3] = n[0];
			}
			/* istanbul ignore next */
			e.writeFloatLE = r ? i : a, e.writeFloatBE = r ? a : i;
			function o(e, r) {
				return n[0] = e[r], n[1] = e[r + 1], n[2] = e[r + 2], n[3] = e[r + 3], t[0];
			}
			function s(e, r) {
				return n[3] = e[r], n[2] = e[r + 1], n[1] = e[r + 2], n[0] = e[r + 3], t[0];
			}
			/* istanbul ignore next */
			e.readFloatLE = r ? o : s, e.readFloatBE = r ? s : o;
		})() : (function() {
			function t(e, t, n, r) {
				var i = +(t < 0);
				if (i && (t = -t), t === 0) e(1 / t > 0 ? 0 : 2147483648, n, r);
				else if (isNaN(t)) e(2143289344, n, r);
				else if (t > 34028234663852886e22) e((i << 31 | 2139095040) >>> 0, n, r);
				else if (t < 11754943508222875e-54) e((i << 31 | Math.round(t / 1401298464324817e-60)) >>> 0, n, r);
				else {
					var a = Math.floor(Math.log(t) / Math.LN2), o = Math.round(t * 2 ** -a * 8388608) & 8388607;
					e((i << 31 | a + 127 << 23 | o) >>> 0, n, r);
				}
			}
			e.writeFloatLE = t.bind(null, r), e.writeFloatBE = t.bind(null, i);
			function n(e, t, n) {
				var r = e(t, n), i = (r >> 31) * 2 + 1, a = r >>> 23 & 255, o = r & 8388607;
				return a === 255 ? o ? NaN : i * Infinity : a === 0 ? i * 1401298464324817e-60 * o : i * 2 ** (a - 150) * (o + 8388608);
			}
			e.readFloatLE = n.bind(null, a), e.readFloatBE = n.bind(null, o);
		})(), typeof Float64Array < "u" ? (function() {
			var t = new Float64Array([-0]), n = new Uint8Array(t.buffer), r = n[7] === 128;
			function i(e, r, i) {
				t[0] = e, r[i] = n[0], r[i + 1] = n[1], r[i + 2] = n[2], r[i + 3] = n[3], r[i + 4] = n[4], r[i + 5] = n[5], r[i + 6] = n[6], r[i + 7] = n[7];
			}
			function a(e, r, i) {
				t[0] = e, r[i] = n[7], r[i + 1] = n[6], r[i + 2] = n[5], r[i + 3] = n[4], r[i + 4] = n[3], r[i + 5] = n[2], r[i + 6] = n[1], r[i + 7] = n[0];
			}
			/* istanbul ignore next */
			e.writeDoubleLE = r ? i : a, e.writeDoubleBE = r ? a : i;
			function o(e, r) {
				return n[0] = e[r], n[1] = e[r + 1], n[2] = e[r + 2], n[3] = e[r + 3], n[4] = e[r + 4], n[5] = e[r + 5], n[6] = e[r + 6], n[7] = e[r + 7], t[0];
			}
			function s(e, r) {
				return n[7] = e[r], n[6] = e[r + 1], n[5] = e[r + 2], n[4] = e[r + 3], n[3] = e[r + 4], n[2] = e[r + 5], n[1] = e[r + 6], n[0] = e[r + 7], t[0];
			}
			/* istanbul ignore next */
			e.readDoubleLE = r ? o : s, e.readDoubleBE = r ? s : o;
		})() : (function() {
			function t(e, t, n, r, i, a) {
				var o = +(r < 0);
				if (o && (r = -r), r === 0) e(0, i, a + t), e(1 / r > 0 ? 0 : 2147483648, i, a + n);
				else if (isNaN(r)) e(0, i, a + t), e(2146959360, i, a + n);
				else if (r > 17976931348623157e292) e(0, i, a + t), e((o << 31 | 2146435072) >>> 0, i, a + n);
				else {
					var s;
					if (r < 22250738585072014e-324) s = r / 5e-324, e(s >>> 0, i, a + t), e((o << 31 | s / 4294967296) >>> 0, i, a + n);
					else {
						var c = Math.floor(Math.log(r) / Math.LN2);
						c === 1024 && (c = 1023), s = r * 2 ** -c, e(s * 4503599627370496 >>> 0, i, a + t), e((o << 31 | c + 1023 << 20 | s * 1048576 & 1048575) >>> 0, i, a + n);
					}
				}
			}
			e.writeDoubleLE = t.bind(null, r, 0, 4), e.writeDoubleBE = t.bind(null, i, 4, 0);
			function n(e, t, n, r, i) {
				var a = e(r, i + t), o = e(r, i + n), s = (o >> 31) * 2 + 1, c = o >>> 20 & 2047, l = 4294967296 * (o & 1048575) + a;
				return c === 2047 ? l ? NaN : s * Infinity : c === 0 ? s * 5e-324 * l : s * 2 ** (c - 1075) * (l + 4503599627370496);
			}
			e.readDoubleLE = n.bind(null, a, 0, 4), e.readDoubleBE = n.bind(null, o, 4, 0);
		})(), e;
	}
	function r(e, t, n) {
		t[n] = e & 255, t[n + 1] = e >>> 8 & 255, t[n + 2] = e >>> 16 & 255, t[n + 3] = e >>> 24;
	}
	function i(e, t, n) {
		t[n] = e >>> 24, t[n + 1] = e >>> 16 & 255, t[n + 2] = e >>> 8 & 255, t[n + 3] = e & 255;
	}
	function a(e, t) {
		return (e[t] | e[t + 1] << 8 | e[t + 2] << 16 | e[t + 3] << 24) >>> 0;
	}
	function o(e, t) {
		return (e[t] << 24 | e[t + 1] << 16 | e[t + 2] << 8 | e[t + 3]) >>> 0;
	}
})), b = /* @__PURE__ */ o(((e, t) => {
	t.exports = n;
	function n(e) {
		try {
			if (typeof l != "function") return null;
			var t = l(e);
			return t && (t.length || Object.keys(t).length) ? t : null;
		} catch {
			return null;
		}
	}
})), x = /* @__PURE__ */ o(((e) => {
	var t = e, n = "�";
	t.length = function(e) {
		for (var t = 0, n = 0, r = 0; r < e.length; ++r) n = e.charCodeAt(r), n < 128 ? t += 1 : n < 2048 ? t += 2 : (n & 64512) == 55296 && (e.charCodeAt(r + 1) & 64512) == 56320 ? (++r, t += 4) : t += 3;
		return t;
	}, t.read = function(e, t, r) {
		if (r - t < 1) return "";
		for (var i = "", a = t; a < r;) {
			var o = e[a++];
			if (o <= 127) i += String.fromCharCode(o);
			else if (o >= 192 && o < 224) {
				var s = (o & 31) << 6 | e[a++] & 63;
				i += s >= 128 ? String.fromCharCode(s) : n;
			} else if (o >= 224 && o < 240) {
				var c = (o & 15) << 12 | (e[a++] & 63) << 6 | e[a++] & 63;
				i += c >= 2048 ? String.fromCharCode(c) : n;
			} else if (o >= 240) {
				var l = (o & 7) << 18 | (e[a++] & 63) << 12 | (e[a++] & 63) << 6 | e[a++] & 63;
				l < 65536 || l > 1114111 ? i += n : (l -= 65536, i += String.fromCharCode(55296 + (l >> 10)), i += String.fromCharCode(56320 + (l & 1023)));
			}
		}
		return i;
	}, t.write = function(e, t, n) {
		for (var r = n, i, a, o = 0; o < e.length; ++o) i = e.charCodeAt(o), i < 128 ? t[n++] = i : i < 2048 ? (t[n++] = i >> 6 | 192, t[n++] = i & 63 | 128) : (i & 64512) == 55296 && ((a = e.charCodeAt(o + 1)) & 64512) == 56320 ? (i = 65536 + ((i & 1023) << 10) + (a & 1023), ++o, t[n++] = i >> 18 | 240, t[n++] = i >> 12 & 63 | 128, t[n++] = i >> 6 & 63 | 128, t[n++] = i & 63 | 128) : (t[n++] = i >> 12 | 224, t[n++] = i >> 6 & 63 | 128, t[n++] = i & 63 | 128);
		return n - r;
	};
})), S = /* @__PURE__ */ o(((e, t) => {
	t.exports = n;
	function n(e, t, n) {
		var r = n || 8192, i = r >>> 1, a = null, o = r;
		return function(n) {
			if (n < 1 || n > i) return e(n);
			o + n > r && (a = e(r), o = 0);
			var s = t.call(a, o, o += n);
			return o & 7 && (o = (o | 7) + 1), s;
		};
	}
})), C = /* @__PURE__ */ o(((e, t) => {
	t.exports = r;
	var n = T();
	function r(e, t) {
		this.lo = e >>> 0, this.hi = t >>> 0;
	}
	var i = r.zero = new r(0, 0);
	i.toNumber = function() {
		return 0;
	}, i.zzEncode = i.zzDecode = function() {
		return this;
	}, i.length = function() {
		return 1;
	};
	var a = r.zeroHash = "\0\0\0\0\0\0\0\0";
	r.fromNumber = function(e) {
		if (e === 0) return i;
		var t = e < 0;
		t && (e = -e);
		var n = e >>> 0, a = (e - n) / 4294967296 >>> 0;
		return t && (a = ~a >>> 0, n = ~n >>> 0, ++n > 4294967295 && (n = 0, ++a > 4294967295 && (a = 0))), new r(n, a);
	}, r.from = function(e) {
		if (typeof e == "number") return r.fromNumber(e);
		if (n.isString(e))
 /* istanbul ignore else */
		if (n.Long) e = n.Long.fromString(e);
		else return r.fromNumber(parseInt(e, 10));
		return e.low || e.high ? new r(e.low >>> 0, e.high >>> 0) : i;
	}, r.prototype.toNumber = function(e) {
		if (!e && this.hi >>> 31) {
			var t = ~this.lo + 1 >>> 0, n = ~this.hi >>> 0;
			return t || (n = n + 1 >>> 0), -(t + n * 4294967296);
		}
		return this.lo + this.hi * 4294967296;
	}, r.prototype.toLong = function(e) {
		return n.Long ? new n.Long(this.lo | 0, this.hi | 0, !!e) : {
			low: this.lo | 0,
			high: this.hi | 0,
			unsigned: !!e
		};
	};
	var o = String.prototype.charCodeAt;
	r.fromHash = function(e) {
		return e === a ? i : new r((o.call(e, 0) | o.call(e, 1) << 8 | o.call(e, 2) << 16 | o.call(e, 3) << 24) >>> 0, (o.call(e, 4) | o.call(e, 5) << 8 | o.call(e, 6) << 16 | o.call(e, 7) << 24) >>> 0);
	}, r.prototype.toHash = function() {
		return String.fromCharCode(this.lo & 255, this.lo >>> 8 & 255, this.lo >>> 16 & 255, this.lo >>> 24, this.hi & 255, this.hi >>> 8 & 255, this.hi >>> 16 & 255, this.hi >>> 24);
	}, r.prototype.zzEncode = function() {
		var e = this.hi >> 31;
		return this.hi = ((this.hi << 1 | this.lo >>> 31) ^ e) >>> 0, this.lo = (this.lo << 1 ^ e) >>> 0, this;
	}, r.prototype.zzDecode = function() {
		var e = -(this.lo & 1);
		return this.lo = ((this.lo >>> 1 | this.hi << 31) ^ e) >>> 0, this.hi = (this.hi >>> 1 ^ e) >>> 0, this;
	}, r.prototype.length = function() {
		var e = this.lo, t = (this.lo >>> 28 | this.hi << 4) >>> 0, n = this.hi >>> 24;
		return n === 0 ? t === 0 ? e < 16384 ? e < 128 ? 1 : 2 : e < 2097152 ? 3 : 4 : t < 16384 ? t < 128 ? 5 : 6 : t < 2097152 ? 7 : 8 : n < 128 ? 9 : 10;
	};
})), w = /* @__PURE__ */ o(((e, t) => {
	(function(n, r) {
		function i(e) {
			return e.default || e;
		}
		typeof define == "function" && define.amd ? define([], function() {
			var e = {};
			return r(e), i(e);
		}) : typeof e == "object" ? (r(e), typeof t == "object" && (t.exports = i(e))) : (function() {
			var e = {};
			r(e), n.Long = i(e);
		})();
	})(typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : e, function(e) {
		Object.defineProperty(e, "__esModule", { value: !0 }), e.default = void 0;
		var t = null;
		try {
			t = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array([
				0,
				97,
				115,
				109,
				1,
				0,
				0,
				0,
				1,
				13,
				2,
				96,
				0,
				1,
				127,
				96,
				4,
				127,
				127,
				127,
				127,
				1,
				127,
				3,
				7,
				6,
				0,
				1,
				1,
				1,
				1,
				1,
				6,
				6,
				1,
				127,
				1,
				65,
				0,
				11,
				7,
				50,
				6,
				3,
				109,
				117,
				108,
				0,
				1,
				5,
				100,
				105,
				118,
				95,
				115,
				0,
				2,
				5,
				100,
				105,
				118,
				95,
				117,
				0,
				3,
				5,
				114,
				101,
				109,
				95,
				115,
				0,
				4,
				5,
				114,
				101,
				109,
				95,
				117,
				0,
				5,
				8,
				103,
				101,
				116,
				95,
				104,
				105,
				103,
				104,
				0,
				0,
				10,
				191,
				1,
				6,
				4,
				0,
				35,
				0,
				11,
				36,
				1,
				1,
				126,
				32,
				0,
				173,
				32,
				1,
				173,
				66,
				32,
				134,
				132,
				32,
				2,
				173,
				32,
				3,
				173,
				66,
				32,
				134,
				132,
				126,
				34,
				4,
				66,
				32,
				135,
				167,
				36,
				0,
				32,
				4,
				167,
				11,
				36,
				1,
				1,
				126,
				32,
				0,
				173,
				32,
				1,
				173,
				66,
				32,
				134,
				132,
				32,
				2,
				173,
				32,
				3,
				173,
				66,
				32,
				134,
				132,
				127,
				34,
				4,
				66,
				32,
				135,
				167,
				36,
				0,
				32,
				4,
				167,
				11,
				36,
				1,
				1,
				126,
				32,
				0,
				173,
				32,
				1,
				173,
				66,
				32,
				134,
				132,
				32,
				2,
				173,
				32,
				3,
				173,
				66,
				32,
				134,
				132,
				128,
				34,
				4,
				66,
				32,
				135,
				167,
				36,
				0,
				32,
				4,
				167,
				11,
				36,
				1,
				1,
				126,
				32,
				0,
				173,
				32,
				1,
				173,
				66,
				32,
				134,
				132,
				32,
				2,
				173,
				32,
				3,
				173,
				66,
				32,
				134,
				132,
				129,
				34,
				4,
				66,
				32,
				135,
				167,
				36,
				0,
				32,
				4,
				167,
				11,
				36,
				1,
				1,
				126,
				32,
				0,
				173,
				32,
				1,
				173,
				66,
				32,
				134,
				132,
				32,
				2,
				173,
				32,
				3,
				173,
				66,
				32,
				134,
				132,
				130,
				34,
				4,
				66,
				32,
				135,
				167,
				36,
				0,
				32,
				4,
				167,
				11
			])), {}).exports;
		} catch {}
		function n(e, t, n) {
			this.low = e | 0, this.high = t | 0, this.unsigned = !!n;
		}
		n.prototype.__isLong__, Object.defineProperty(n.prototype, "__isLong__", { value: !0 });
		function r(e) {
			return (e && e.__isLong__) === !0;
		}
		function i(e) {
			var t = Math.clz32(e & -e);
			return e ? 31 - t : t;
		}
		n.isLong = r;
		var a = {}, o = {};
		function s(e, t) {
			var n, r, i;
			return t ? (e >>>= 0, (i = 0 <= e && e < 256) && (r = o[e], r) ? r : (n = l(e, 0, !0), i && (o[e] = n), n)) : (e |= 0, (i = -128 <= e && e < 128) && (r = a[e], r) ? r : (n = l(e, e < 0 ? -1 : 0, !1), i && (a[e] = n), n));
		}
		n.fromInt = s;
		function c(e, t) {
			if (isNaN(e)) return t ? b : y;
			if (t) {
				if (e < 0) return b;
				if (e >= g) return T;
			} else {
				if (e <= -_) return E;
				if (e + 1 >= _) return w;
			}
			return e < 0 ? c(-e, t).neg() : l(e % h | 0, e / h | 0, t);
		}
		n.fromNumber = c;
		function l(e, t, r) {
			return new n(e, t, r);
		}
		n.fromBits = l;
		var u = Math.pow;
		function d(e, t, n) {
			if (e.length === 0) throw Error("empty string");
			if (typeof t == "number" ? (n = t, t = !1) : t = !!t, e === "NaN" || e === "Infinity" || e === "+Infinity" || e === "-Infinity") return t ? b : y;
			if (n ||= 10, n < 2 || 36 < n) throw RangeError("radix");
			var r;
			if ((r = e.indexOf("-")) > 0) throw Error("interior hyphen");
			if (r === 0) return d(e.substring(1), t, n).neg();
			for (var i = c(u(n, 8)), a = y, o = 0; o < e.length; o += 8) {
				var s = Math.min(8, e.length - o), l = parseInt(e.substring(o, o + s), n);
				if (s < 8) {
					var f = c(u(n, s));
					a = a.mul(f).add(c(l));
				} else a = a.mul(i), a = a.add(c(l));
			}
			return a.unsigned = t, a;
		}
		n.fromString = d;
		function f(e, t) {
			return typeof e == "number" ? c(e, t) : typeof e == "string" ? d(e, t) : l(e.low, e.high, typeof t == "boolean" ? t : e.unsigned);
		}
		n.fromValue = f;
		var p = 65536, m = 1 << 24, h = p * p, g = h * h, _ = g / 2, v = s(m), y = s(0);
		n.ZERO = y;
		var b = s(0, !0);
		n.UZERO = b;
		var x = s(1);
		n.ONE = x;
		var S = s(1, !0);
		n.UONE = S;
		var C = s(-1);
		n.NEG_ONE = C;
		var w = l(-1, 2147483647, !1);
		n.MAX_VALUE = w;
		var T = l(-1, -1, !0);
		n.MAX_UNSIGNED_VALUE = T;
		var E = l(0, -2147483648, !1);
		n.MIN_VALUE = E;
		var D = n.prototype;
		D.toInt = function() {
			return this.unsigned ? this.low >>> 0 : this.low;
		}, D.toNumber = function() {
			return this.unsigned ? (this.high >>> 0) * h + (this.low >>> 0) : this.high * h + (this.low >>> 0);
		}, D.toString = function(e) {
			if (e ||= 10, e < 2 || 36 < e) throw RangeError("radix");
			if (this.isZero()) return "0";
			if (this.isNegative()) if (this.eq(E)) {
				var t = c(e), n = this.div(t), r = n.mul(t).sub(this);
				return n.toString(e) + r.toInt().toString(e);
			} else return "-" + this.neg().toString(e);
			for (var i = c(u(e, 6), this.unsigned), a = this, o = "";;) {
				var s = a.div(i), l = (a.sub(s.mul(i)).toInt() >>> 0).toString(e);
				if (a = s, a.isZero()) return l + o;
				for (; l.length < 6;) l = "0" + l;
				o = "" + l + o;
			}
		}, D.getHighBits = function() {
			return this.high;
		}, D.getHighBitsUnsigned = function() {
			return this.high >>> 0;
		}, D.getLowBits = function() {
			return this.low;
		}, D.getLowBitsUnsigned = function() {
			return this.low >>> 0;
		}, D.getNumBitsAbs = function() {
			if (this.isNegative()) return this.eq(E) ? 64 : this.neg().getNumBitsAbs();
			for (var e = this.high == 0 ? this.low : this.high, t = 31; t > 0 && !(e & 1 << t); t--);
			return this.high == 0 ? t + 1 : t + 33;
		}, D.isSafeInteger = function() {
			var e = this.high >> 21;
			return e ? this.unsigned ? !1 : e === -1 && !(this.low === 0 && this.high === -2097152) : !0;
		}, D.isZero = function() {
			return this.high === 0 && this.low === 0;
		}, D.eqz = D.isZero, D.isNegative = function() {
			return !this.unsigned && this.high < 0;
		}, D.isPositive = function() {
			return this.unsigned || this.high >= 0;
		}, D.isOdd = function() {
			return (this.low & 1) == 1;
		}, D.isEven = function() {
			return (this.low & 1) == 0;
		}, D.equals = function(e) {
			return r(e) || (e = f(e)), this.unsigned !== e.unsigned && this.high >>> 31 == 1 && e.high >>> 31 == 1 ? !1 : this.high === e.high && this.low === e.low;
		}, D.eq = D.equals, D.notEquals = function(e) {
			return !this.eq(e);
		}, D.neq = D.notEquals, D.ne = D.notEquals, D.lessThan = function(e) {
			return this.comp(e) < 0;
		}, D.lt = D.lessThan, D.lessThanOrEqual = function(e) {
			return this.comp(e) <= 0;
		}, D.lte = D.lessThanOrEqual, D.le = D.lessThanOrEqual, D.greaterThan = function(e) {
			return this.comp(e) > 0;
		}, D.gt = D.greaterThan, D.greaterThanOrEqual = function(e) {
			return this.comp(e) >= 0;
		}, D.gte = D.greaterThanOrEqual, D.ge = D.greaterThanOrEqual, D.compare = function(e) {
			if (r(e) || (e = f(e)), this.eq(e)) return 0;
			var t = this.isNegative(), n = e.isNegative();
			return t && !n ? -1 : !t && n ? 1 : this.unsigned ? e.high >>> 0 > this.high >>> 0 || e.high === this.high && e.low >>> 0 > this.low >>> 0 ? -1 : 1 : this.sub(e).isNegative() ? -1 : 1;
		}, D.comp = D.compare, D.negate = function() {
			return !this.unsigned && this.eq(E) ? E : this.not().add(x);
		}, D.neg = D.negate, D.add = function(e) {
			r(e) || (e = f(e));
			var t = this.high >>> 16, n = this.high & 65535, i = this.low >>> 16, a = this.low & 65535, o = e.high >>> 16, s = e.high & 65535, c = e.low >>> 16, u = e.low & 65535, d = 0, p = 0, m = 0, h = 0;
			return h += a + u, m += h >>> 16, h &= 65535, m += i + c, p += m >>> 16, m &= 65535, p += n + s, d += p >>> 16, p &= 65535, d += t + o, d &= 65535, l(m << 16 | h, d << 16 | p, this.unsigned);
		}, D.subtract = function(e) {
			return r(e) || (e = f(e)), this.add(e.neg());
		}, D.sub = D.subtract, D.multiply = function(e) {
			if (this.isZero()) return this;
			if (r(e) || (e = f(e)), t) return l(t.mul(this.low, this.high, e.low, e.high), t.get_high(), this.unsigned);
			if (e.isZero()) return this.unsigned ? b : y;
			if (this.eq(E)) return e.isOdd() ? E : y;
			if (e.eq(E)) return this.isOdd() ? E : y;
			if (this.isNegative()) return e.isNegative() ? this.neg().mul(e.neg()) : this.neg().mul(e).neg();
			if (e.isNegative()) return this.mul(e.neg()).neg();
			if (this.lt(v) && e.lt(v)) return c(this.toNumber() * e.toNumber(), this.unsigned);
			var n = this.high >>> 16, i = this.high & 65535, a = this.low >>> 16, o = this.low & 65535, s = e.high >>> 16, u = e.high & 65535, d = e.low >>> 16, p = e.low & 65535, m = 0, h = 0, g = 0, _ = 0;
			return _ += o * p, g += _ >>> 16, _ &= 65535, g += a * p, h += g >>> 16, g &= 65535, g += o * d, h += g >>> 16, g &= 65535, h += i * p, m += h >>> 16, h &= 65535, h += a * d, m += h >>> 16, h &= 65535, h += o * u, m += h >>> 16, h &= 65535, m += n * p + i * d + a * u + o * s, m &= 65535, l(g << 16 | _, m << 16 | h, this.unsigned);
		}, D.mul = D.multiply, D.divide = function(e) {
			if (r(e) || (e = f(e)), e.isZero()) throw Error("division by zero");
			if (t) return !this.unsigned && this.high === -2147483648 && e.low === -1 && e.high === -1 ? this : l((this.unsigned ? t.div_u : t.div_s)(this.low, this.high, e.low, e.high), t.get_high(), this.unsigned);
			if (this.isZero()) return this.unsigned ? b : y;
			var n, i, a;
			if (this.unsigned) {
				if (e.unsigned || (e = e.toUnsigned()), e.gt(this)) return b;
				if (e.gt(this.shru(1))) return S;
				a = b;
			} else {
				if (this.eq(E)) return e.eq(x) || e.eq(C) ? E : e.eq(E) ? x : (n = this.shr(1).div(e).shl(1), n.eq(y) ? e.isNegative() ? x : C : (i = this.sub(e.mul(n)), a = n.add(i.div(e)), a));
				if (e.eq(E)) return this.unsigned ? b : y;
				if (this.isNegative()) return e.isNegative() ? this.neg().div(e.neg()) : this.neg().div(e).neg();
				if (e.isNegative()) return this.div(e.neg()).neg();
				a = y;
			}
			for (i = this; i.gte(e);) {
				n = Math.max(1, Math.floor(i.toNumber() / e.toNumber()));
				for (var o = Math.ceil(Math.log(n) / Math.LN2), s = o <= 48 ? 1 : u(2, o - 48), d = c(n), p = d.mul(e); p.isNegative() || p.gt(i);) n -= s, d = c(n, this.unsigned), p = d.mul(e);
				d.isZero() && (d = x), a = a.add(d), i = i.sub(p);
			}
			return a;
		}, D.div = D.divide, D.modulo = function(e) {
			return r(e) || (e = f(e)), t ? l((this.unsigned ? t.rem_u : t.rem_s)(this.low, this.high, e.low, e.high), t.get_high(), this.unsigned) : this.sub(this.div(e).mul(e));
		}, D.mod = D.modulo, D.rem = D.modulo, D.not = function() {
			return l(~this.low, ~this.high, this.unsigned);
		}, D.countLeadingZeros = function() {
			return this.high ? Math.clz32(this.high) : Math.clz32(this.low) + 32;
		}, D.clz = D.countLeadingZeros, D.countTrailingZeros = function() {
			return this.low ? i(this.low) : i(this.high) + 32;
		}, D.ctz = D.countTrailingZeros, D.and = function(e) {
			return r(e) || (e = f(e)), l(this.low & e.low, this.high & e.high, this.unsigned);
		}, D.or = function(e) {
			return r(e) || (e = f(e)), l(this.low | e.low, this.high | e.high, this.unsigned);
		}, D.xor = function(e) {
			return r(e) || (e = f(e)), l(this.low ^ e.low, this.high ^ e.high, this.unsigned);
		}, D.shiftLeft = function(e) {
			return r(e) && (e = e.toInt()), (e &= 63) == 0 ? this : e < 32 ? l(this.low << e, this.high << e | this.low >>> 32 - e, this.unsigned) : l(0, this.low << e - 32, this.unsigned);
		}, D.shl = D.shiftLeft, D.shiftRight = function(e) {
			return r(e) && (e = e.toInt()), (e &= 63) == 0 ? this : e < 32 ? l(this.low >>> e | this.high << 32 - e, this.high >> e, this.unsigned) : l(this.high >> e - 32, this.high >= 0 ? 0 : -1, this.unsigned);
		}, D.shr = D.shiftRight, D.shiftRightUnsigned = function(e) {
			return r(e) && (e = e.toInt()), (e &= 63) == 0 ? this : e < 32 ? l(this.low >>> e | this.high << 32 - e, this.high >>> e, this.unsigned) : l(e === 32 ? this.high : this.high >>> e - 32, 0, this.unsigned);
		}, D.shru = D.shiftRightUnsigned, D.shr_u = D.shiftRightUnsigned, D.rotateLeft = function(e) {
			var t;
			return r(e) && (e = e.toInt()), (e &= 63) == 0 ? this : e === 32 ? l(this.high, this.low, this.unsigned) : e < 32 ? (t = 32 - e, l(this.low << e | this.high >>> t, this.high << e | this.low >>> t, this.unsigned)) : (e -= 32, t = 32 - e, l(this.high << e | this.low >>> t, this.low << e | this.high >>> t, this.unsigned));
		}, D.rotl = D.rotateLeft, D.rotateRight = function(e) {
			var t;
			return r(e) && (e = e.toInt()), (e &= 63) == 0 ? this : e === 32 ? l(this.high, this.low, this.unsigned) : e < 32 ? (t = 32 - e, l(this.high << t | this.low >>> e, this.low << t | this.high >>> e, this.unsigned)) : (e -= 32, t = 32 - e, l(this.low << t | this.high >>> e, this.high << t | this.low >>> e, this.unsigned));
		}, D.rotr = D.rotateRight, D.toSigned = function() {
			return this.unsigned ? l(this.low, this.high, !1) : this;
		}, D.toUnsigned = function() {
			return this.unsigned ? this : l(this.low, this.high, !0);
		}, D.toBytes = function(e) {
			return e ? this.toBytesLE() : this.toBytesBE();
		}, D.toBytesLE = function() {
			var e = this.high, t = this.low;
			return [
				t & 255,
				t >>> 8 & 255,
				t >>> 16 & 255,
				t >>> 24,
				e & 255,
				e >>> 8 & 255,
				e >>> 16 & 255,
				e >>> 24
			];
		}, D.toBytesBE = function() {
			var e = this.high, t = this.low;
			return [
				e >>> 24,
				e >>> 16 & 255,
				e >>> 8 & 255,
				e & 255,
				t >>> 24,
				t >>> 16 & 255,
				t >>> 8 & 255,
				t & 255
			];
		}, n.fromBytes = function(e, t, r) {
			return r ? n.fromBytesLE(e, t) : n.fromBytesBE(e, t);
		}, n.fromBytesLE = function(e, t) {
			return new n(e[0] | e[1] << 8 | e[2] << 16 | e[3] << 24, e[4] | e[5] << 8 | e[6] << 16 | e[7] << 24, t);
		}, n.fromBytesBE = function(e, t) {
			return new n(e[4] << 24 | e[5] << 16 | e[6] << 8 | e[7], e[0] << 24 | e[1] << 16 | e[2] << 8 | e[3], t);
		}, typeof BigInt == "function" && (n.fromBigInt = function(e, t) {
			return l(Number(BigInt.asIntN(32, e)), Number(BigInt.asIntN(32, e >> BigInt(32))), t);
		}, n.fromValue = function(e, t) {
			return typeof e == "bigint" ? n.fromBigInt(e, t) : f(e, t);
		}, D.toBigInt = function() {
			var e = BigInt(this.low >>> 0);
			return BigInt(this.unsigned ? this.high >>> 0 : this.high) << BigInt(32) | e;
		}), e.default = n;
	});
})), T = /* @__PURE__ */ o(((e) => {
	var t = e;
	t.asPromise = g(), t.base64 = _(), t.EventEmitter = v(), t.float = y(), t.inquire = b(), t.utf8 = x(), t.pool = S(), t.LongBits = C(), t.isNode = !!(typeof global < "u" && global && global.process && global.process.versions && global.process.versions.node), t.global = t.isNode && global || typeof window < "u" && window || typeof self < "u" && self || e, t.emptyArray = Object.freeze ? Object.freeze([]) : 	/* istanbul ignore next */ [], t.emptyObject = Object.freeze ? Object.freeze({}) : 	/* istanbul ignore next */ {}, t.isInteger = Number.isInteger || function(e) {
		return typeof e == "number" && isFinite(e) && Math.floor(e) === e;
	}, t.isString = function(e) {
		return typeof e == "string" || e instanceof String;
	}, t.isObject = function(e) {
		return e && typeof e == "object";
	}, t.isset = t.isSet = function(e, t) {
		var n = e[t];
		return n != null && e.hasOwnProperty(t) ? typeof n != "object" || (Array.isArray(n) ? n.length : Object.keys(n).length) > 0 : !1;
	}, t.Buffer = (function() {
		try {
			var e = t.global.Buffer;
			return e.prototype.utf8Write ? e : 			/* istanbul ignore next */ null;
		} catch {
			/* istanbul ignore next */
			return null;
		}
	})(), t._Buffer_from = null, t._Buffer_allocUnsafe = null, t.newBuffer = function(e) {
		/* istanbul ignore next */
		return typeof e == "number" ? t.Buffer ? t._Buffer_allocUnsafe(e) : new t.Array(e) : t.Buffer ? t._Buffer_from(e) : typeof Uint8Array > "u" ? e : new Uint8Array(e);
	}, t.Array = typeof Uint8Array < "u" ? Uint8Array : Array, t.Long = t.global.dcodeIO && t.global.dcodeIO.Long || t.global.Long || (function() {
		try {
			var e = w();
			return e && e.isLong ? e : null;
		} catch {
			/* istanbul ignore next */
			return null;
		}
	})(), t.key2Re = /^(?:true|false|0|1)$/, t.key32Re = /^-?(?:0|[1-9][0-9]*)$/, t.key64Re = /^(?:[\x00-\xff]{8}|-?(?:0|[1-9][0-9]*))$/, t.longToHash = function(e) {
		return e ? t.LongBits.from(e).toHash() : t.LongBits.zeroHash;
	}, t.longFromHash = function(e, n) {
		var r = t.LongBits.fromHash(e);
		return t.Long ? t.Long.fromBits(r.lo, r.hi, n) : r.toNumber(!!n);
	}, t.longFromKey = function(e, n) {
		return t.key64Re.test(e) && !t.key32Re.test(e) ? t.longFromHash(e, n) : e;
	}, t.boolFromKey = function(e) {
		return e === "true" || e === "1";
	};
	function n(e, t, n) {
		for (var r = Object.keys(t), i = 0; i < r.length; ++i) (e[r[i]] === void 0 || !n) && r[i] !== "__proto__" && (e[r[i]] = t[r[i]]);
		return e;
	}
	t.merge = n, t.recursionLimit = 100, t.makeProp = function(e, t, n) {
		Object.prototype.hasOwnProperty.call(e, t) || Object.defineProperty(e, t, {
			enumerable: n === void 0 ? !0 : n,
			configurable: !0,
			writable: !0
		});
	}, t.lcFirst = function(e) {
		return e.charAt(0).toLowerCase() + e.substring(1);
	};
	function r(e) {
		function t(e, r) {
			if (!(this instanceof t)) return new t(e, r);
			Object.defineProperty(this, "message", { get: function() {
				return e;
			} }), Error.captureStackTrace ? Error.captureStackTrace(this, t) : Object.defineProperty(this, "stack", { value: (/* @__PURE__ */ Error()).stack || "" }), r && n(this, r);
		}
		return t.prototype = Object.create(Error.prototype, {
			constructor: {
				value: t,
				writable: !0,
				enumerable: !1,
				configurable: !0
			},
			name: {
				get: function() {
					return e;
				},
				set: void 0,
				enumerable: !1,
				configurable: !0
			},
			toString: {
				value: function() {
					return this.name + ": " + this.message;
				},
				writable: !0,
				enumerable: !1,
				configurable: !0
			}
		}), t;
	}
	t.newError = r, t.ProtocolError = r("ProtocolError"), t.oneOfGetter = function(e) {
		for (var t = {}, n = 0; n < e.length; ++n) t[e[n]] = 1;
		return function() {
			for (var e = Object.keys(this), n = e.length - 1; n > -1; --n) if (t[e[n]] === 1 && this[e[n]] !== void 0 && this[e[n]] !== null) return e[n];
		};
	}, t.oneOfSetter = function(e) {
		return function(t) {
			for (var n = 0; n < e.length; ++n) e[n] !== t && delete this[e[n]];
		};
	}, t.toJSONOptions = {
		longs: String,
		enums: String,
		bytes: String,
		json: !0
	}, t._configure = function() {
		var e = t.Buffer;
		/* istanbul ignore if */
		if (!e) {
			t._Buffer_from = t._Buffer_allocUnsafe = null;
			return;
		}
		t._Buffer_from = e.from !== Uint8Array.from && e.from || function(t, n) {
			return new e(t, n);
		}, t._Buffer_allocUnsafe = e.allocUnsafe || function(t) {
			return new e(t);
		};
	};
})), E = /* @__PURE__ */ o(((e, t) => {
	t.exports = u;
	var n = T(), r, i = n.LongBits, a = n.base64, o = n.utf8;
	function s(e, t, n) {
		this.fn = e, this.len = t, this.next = void 0, this.val = n;
	}
	/* istanbul ignore next */
	function c() {}
	function l(e) {
		this.head = e.head, this.tail = e.tail, this.len = e.len, this.next = e.states;
	}
	function u() {
		this.len = 0, this.head = new s(c, 0, 0), this.tail = this.head, this.states = null;
	}
	var d = function() {
		return n.Buffer ? function() {
			return (u.create = function() {
				return new r();
			})();
		} : function() {
			return new u();
		};
	};
	u.create = d(), u.alloc = function(e) {
		return new n.Array(e);
	}, n.Array !== Array && (u.alloc = n.pool(u.alloc, n.Array.prototype.subarray)), u.prototype._push = function(e, t, n) {
		return this.tail = this.tail.next = new s(e, t, n), this.len += t, this;
	};
	function f(e, t, n) {
		t[n] = e & 255;
	}
	function p(e, t, n) {
		for (; e > 127;) t[n++] = e & 127 | 128, e >>>= 7;
		t[n] = e;
	}
	function m(e, t) {
		this.len = e, this.next = void 0, this.val = t;
	}
	m.prototype = Object.create(s.prototype), m.prototype.fn = p, u.prototype.uint32 = function(e) {
		return this.len += (this.tail = this.tail.next = new m((e >>>= 0) < 128 ? 1 : e < 16384 ? 2 : e < 2097152 ? 3 : e < 268435456 ? 4 : 5, e)).len, this;
	}, u.prototype.int32 = function(e) {
		return e < 0 ? this._push(h, 10, i.fromNumber(e)) : this.uint32(e);
	}, u.prototype.sint32 = function(e) {
		return this.uint32((e << 1 ^ e >> 31) >>> 0);
	};
	function h(e, t, n) {
		for (; e.hi;) t[n++] = e.lo & 127 | 128, e.lo = (e.lo >>> 7 | e.hi << 25) >>> 0, e.hi >>>= 7;
		for (; e.lo > 127;) t[n++] = e.lo & 127 | 128, e.lo >>>= 7;
		t[n++] = e.lo;
	}
	u.prototype.uint64 = function(e) {
		var t = i.from(e);
		return this._push(h, t.length(), t);
	}, u.prototype.int64 = u.prototype.uint64, u.prototype.sint64 = function(e) {
		var t = i.from(e).zzEncode();
		return this._push(h, t.length(), t);
	}, u.prototype.bool = function(e) {
		return this._push(f, 1, +!!e);
	};
	function g(e, t, n) {
		t[n] = e & 255, t[n + 1] = e >>> 8 & 255, t[n + 2] = e >>> 16 & 255, t[n + 3] = e >>> 24;
	}
	u.prototype.fixed32 = function(e) {
		return this._push(g, 4, e >>> 0);
	}, u.prototype.sfixed32 = u.prototype.fixed32, u.prototype.fixed64 = function(e) {
		var t = i.from(e);
		return this._push(g, 4, t.lo)._push(g, 4, t.hi);
	}, u.prototype.sfixed64 = u.prototype.fixed64, u.prototype.float = function(e) {
		return this._push(n.float.writeFloatLE, 4, e);
	}, u.prototype.double = function(e) {
		return this._push(n.float.writeDoubleLE, 8, e);
	};
	var _ = n.Array.prototype.set ? function(e, t, n) {
		t.set(e, n);
	} : function(e, t, n) {
		for (var r = 0; r < e.length; ++r) t[n + r] = e[r];
	};
	u.prototype.bytes = function(e) {
		var t = e.length >>> 0;
		if (!t) return this._push(f, 1, 0);
		if (n.isString(e)) {
			var r = u.alloc(t = a.length(e));
			a.decode(e, r, 0), e = r;
		}
		return this.uint32(t)._push(_, t, e);
	}, u.prototype.raw = function(e) {
		var t = e.length >>> 0;
		return t ? this._push(_, t, e) : this;
	}, u.prototype.string = function(e) {
		var t = o.length(e);
		return t ? this.uint32(t)._push(o.write, t, e) : this._push(f, 1, 0);
	}, u.prototype.fork = function() {
		return this.states = new l(this), this.head = this.tail = new s(c, 0, 0), this.len = 0, this;
	}, u.prototype.reset = function() {
		return this.states ? (this.head = this.states.head, this.tail = this.states.tail, this.len = this.states.len, this.states = this.states.next) : (this.head = this.tail = new s(c, 0, 0), this.len = 0), this;
	}, u.prototype.ldelim = function() {
		var e = this.head, t = this.tail, n = this.len;
		return this.reset().uint32(n), n && (this.tail.next = e.next, this.tail = t, this.len += n), this;
	}, u.prototype.finish = function() {
		return this.finishInto(this.constructor.alloc(this.len), 0);
	}, u.prototype.finishInto = function(e, t) {
		t === void 0 && (t = 0);
		for (var n = this.head.next, r = t; n;) n.fn(n.val, e, r), r += n.len, n = n.next;
		return e;
	}, u._configure = function(e) {
		r = e, u.create = d(), r._configure();
	};
})), D = /* @__PURE__ */ o(((e, t) => {
	t.exports = i;
	var n = E();
	(i.prototype = Object.create(n.prototype)).constructor = i;
	var r = T();
	function i() {
		n.call(this);
	}
	i._configure = function() {
		i.alloc = r._Buffer_allocUnsafe, i.writeBytesBuffer = r.Buffer && r.Buffer.prototype instanceof Uint8Array && r.Buffer.prototype.set.name === "set" ? function(e, t, n) {
			t.set(e, n);
		} : function(e, t, n) {
			if (e.copy) e.copy(t, n, 0, e.length);
			else for (var r = 0; r < e.length;) t[n++] = e[r++];
		};
	}, i.prototype.bytes = function(e) {
		r.isString(e) && (e = r._Buffer_from(e, "base64"));
		var t = e.length >>> 0;
		return this.uint32(t), t && this._push(i.writeBytesBuffer, t, e), this;
	}, i.prototype.raw = function(e) {
		var t = e.length >>> 0;
		return t ? this._push(i.writeBytesBuffer, t, e) : this;
	};
	function a(e, t, n) {
		e.length < 40 ? r.utf8.write(e, t, n) : t.utf8Write ? t.utf8Write(e, n) : t.write(e, n);
	}
	i.prototype.string = function(e) {
		var t = r.Buffer.byteLength(e);
		return this.uint32(t), t && this._push(a, t, e), this;
	}, i._configure();
})), O = /* @__PURE__ */ o(((e, t) => {
	t.exports = s;
	var n = T(), r, i = n.LongBits, a = n.utf8;
	/* istanbul ignore next */
	function o(e, t) {
		return RangeError("index out of range: " + e.pos + " + " + (t || 1) + " > " + e.len);
	}
	function s(e) {
		this.buf = e, this.pos = 0, this.len = e.length;
	}
	var c = typeof Uint8Array < "u" ? function(e) {
		if (e instanceof Uint8Array || Array.isArray(e)) return new s(e);
		throw Error("illegal buffer");
	} : function(e) {
		if (Array.isArray(e)) return new s(e);
		throw Error("illegal buffer");
	}, l = function() {
		return n.Buffer ? function(e) {
			return (s.create = function(e) {
				return n.Buffer.isBuffer(e) ? new r(e) : c(e);
			})(e);
		} : c;
	};
	s.create = l(), s.prototype._slice = n.Array.prototype.subarray || n.Array.prototype.slice, s.prototype.raw = function(e, t) {
		return Array.isArray(this.buf) ? this.buf.slice(e, t) : e === t ? new this.buf.constructor(0) : this._slice.call(this.buf, e, t);
	}, s.prototype.uint32 = function() {
		var e = this.buf, t = this.pos, n = (e[t] & 127) >>> 0;
		if (e[t++] < 128 || (n = (n | (e[t] & 127) << 7) >>> 0, e[t++] < 128) || (n = (n | (e[t] & 127) << 14) >>> 0, e[t++] < 128) || (n = (n | (e[t] & 127) << 21) >>> 0, e[t++] < 128) || (n = (n | (e[t] & 15) << 28) >>> 0, e[t++] < 128)) return this.pos = t, n;
		for (var r = 0; r < 5; ++r) {
			/* istanbul ignore if */
			if (t >= this.len) throw this.pos = t, o(this);
			if (e[t++] < 128) return this.pos = t, n;
		}
		throw this.pos = t, Error("invalid varint encoding");
	}, s.prototype.tag = function() {
		var e = this.buf, t = this.pos, n = (e[t] & 127) >>> 0;
		if (e[t++] < 128 || (n = (n | (e[t] & 127) << 7) >>> 0, e[t++] < 128) || (n = (n | (e[t] & 127) << 14) >>> 0, e[t++] < 128) || (n = (n | (e[t] & 127) << 21) >>> 0, e[t++] < 128)) return this.pos = t, n;
		if (n = (n | (e[t] & 15) << 28) >>> 0, e[t] < 128 && !(e[t] & 112)) return this.pos = t + 1, n;
		throw this.pos = t + 1, Error("invalid tag encoding");
	}, s.prototype.int32 = function() {
		return this.uint32() | 0;
	}, s.prototype.sint32 = function() {
		var e = this.uint32();
		return e >>> 1 ^ -(e & 1) | 0;
	};
	function u() {
		var e = new i(0, 0), t = 0;
		if (this.len - this.pos > 4) {
			for (; t < 4; ++t) if (e.lo = (e.lo | (this.buf[this.pos] & 127) << t * 7) >>> 0, this.buf[this.pos++] < 128) return e;
			if (e.lo = (e.lo | (this.buf[this.pos] & 127) << 28) >>> 0, e.hi = (e.hi | (this.buf[this.pos] & 127) >> 4) >>> 0, this.buf[this.pos++] < 128) return e;
			t = 0;
		} else {
			for (; t < 3; ++t) {
				/* istanbul ignore if */
				if (this.pos >= this.len) throw o(this);
				if (e.lo = (e.lo | (this.buf[this.pos] & 127) << t * 7) >>> 0, this.buf[this.pos++] < 128) return e;
			}
			return e.lo = (e.lo | (this.buf[this.pos++] & 127) << t * 7) >>> 0, e;
		}
		if (this.len - this.pos > 4) {
			for (; t < 5; ++t) if (e.hi = (e.hi | (this.buf[this.pos] & 127) << t * 7 + 3) >>> 0, this.buf[this.pos++] < 128) return e;
		} else for (; t < 5; ++t) {
			/* istanbul ignore if */
			if (this.pos >= this.len) throw o(this);
			if (e.hi = (e.hi | (this.buf[this.pos] & 127) << t * 7 + 3) >>> 0, this.buf[this.pos++] < 128) return e;
		}
		/* istanbul ignore next */
		throw Error("invalid varint encoding");
	}
	s.prototype.bool = function() {
		for (var e = !1, t, n = 0; n < 10; ++n) {
			/* istanbul ignore if */
			if (this.pos >= this.len) throw o(this);
			if (t = this.buf[this.pos++], t & 127 && (e = !0), t < 128) return e;
		}
		/* istanbul ignore next */
		throw Error("invalid varint encoding");
	};
	function d(e, t) {
		return (e[t - 4] | e[t - 3] << 8 | e[t - 2] << 16 | e[t - 1] << 24) >>> 0;
	}
	s.prototype.fixed32 = function() {
		/* istanbul ignore if */
		if (this.pos + 4 > this.len) throw o(this, 4);
		return d(this.buf, this.pos += 4);
	}, s.prototype.sfixed32 = function() {
		/* istanbul ignore if */
		if (this.pos + 4 > this.len) throw o(this, 4);
		return d(this.buf, this.pos += 4) | 0;
	};
	function f() {
		/* istanbul ignore if */
		if (this.pos + 8 > this.len) throw o(this, 8);
		return new i(d(this.buf, this.pos += 4), d(this.buf, this.pos += 4));
	}
	s.prototype.float = function() {
		/* istanbul ignore if */
		if (this.pos + 4 > this.len) throw o(this, 4);
		var e = n.float.readFloatLE(this.buf, this.pos);
		return this.pos += 4, e;
	}, s.prototype.double = function() {
		/* istanbul ignore if */
		if (this.pos + 8 > this.len) throw o(this, 4);
		var e = n.float.readDoubleLE(this.buf, this.pos);
		return this.pos += 8, e;
	}, s.prototype.bytes = function() {
		var e = this.uint32(), t = this.pos, n = this.pos + e;
		/* istanbul ignore if */
		if (n > this.len) throw o(this, e);
		return this.pos = n, this.raw(t, n);
	}, s.prototype.string = function() {
		var e = this.uint32(), t = this.pos, n = this.pos + e;
		/* istanbul ignore if */
		if (n > this.len) throw o(this, e);
		return this.pos = n, a.read(this.buf, t, n);
	}, s.prototype.skip = function(e) {
		if (typeof e == "number") {
			/* istanbul ignore if */
			if (this.pos + e > this.len) throw o(this, e);
			this.pos += e;
		} else do
			/* istanbul ignore if */
			if (this.pos >= this.len) throw o(this);
		while (this.buf[this.pos++] & 128);
		return this;
	}, s.recursionLimit = n.recursionLimit, s.prototype.skipType = function(e, t, n) {
		if (t === void 0 && (t = 0), t > s.recursionLimit) throw Error("max depth exceeded");
		if (n === 0) throw Error("illegal tag: field number 0");
		switch (e) {
			case 0:
				this.skip();
				break;
			case 1:
				this.skip(8);
				break;
			case 2:
				this.skip(this.uint32());
				break;
			case 3:
				for (;;) {
					var r = this.tag(), i = r >>> 3;
					if (e = r & 7, !i) throw Error("illegal tag: field number 0");
					if (e === 4) {
						if (n !== void 0 && i !== n) throw Error("invalid end group tag");
						break;
					}
					this.skipType(e, t + 1, i);
				}
				break;
			case 5:
				this.skip(4);
				break;
			/* istanbul ignore next */
			default: throw Error("invalid wire type " + e + " at offset " + this.pos);
		}
		return this;
	}, s._configure = function(e) {
		r = e, s.create = l(), r._configure();
		var t = n.Long ? "toLong" : 		/* istanbul ignore next */ "toNumber";
		n.merge(s.prototype, {
			int64: function() {
				return u.call(this)[t](!1);
			},
			uint64: function() {
				return u.call(this)[t](!0);
			},
			sint64: function() {
				return u.call(this).zzDecode()[t](!1);
			},
			fixed64: function() {
				return f.call(this)[t](!0);
			},
			sfixed64: function() {
				return f.call(this)[t](!1);
			}
		});
	};
})), k = /* @__PURE__ */ o(((e, t) => {
	t.exports = i;
	var n = O();
	(i.prototype = Object.create(n.prototype)).constructor = i;
	var r = T();
	function i(e) {
		n.call(this, e);
	}
	i._configure = function() {
		/* istanbul ignore else */
		r.Buffer && (i.prototype._slice = r.Buffer.prototype.slice);
	}, i.prototype.raw = function(e, t) {
		return e === t ? r.Buffer.alloc(0) : this._slice.call(this.buf, e, t);
	}, i.prototype.string = function() {
		var e = this.uint32(), t = this.pos, n = this.pos + e;
		/* istanbul ignore if */
		if (n > this.len) throw RangeError("index out of range: " + this.pos + " + " + e + " > " + this.len);
		return this.pos = n, this.buf.utf8Slice ? this.buf.utf8Slice(t, n) : this.buf.toString("utf-8", t, n);
	}, i._configure();
})), A = /* @__PURE__ */ o(((e, t) => {
	t.exports = r;
	var n = T();
	(r.prototype = Object.create(n.EventEmitter.prototype)).constructor = r;
	function r(e, t, r) {
		if (typeof e != "function") throw TypeError("rpcImpl must be a function");
		n.EventEmitter.call(this), this.rpcImpl = e, this.requestDelimited = !!t, this.responseDelimited = !!r;
	}
	r.prototype.rpcCall = function e(t, r, i, a, o) {
		if (!a) throw TypeError("request must be specified");
		var s = this;
		if (!o) return n.asPromise(e, s, t, r, i, a);
		if (!s.rpcImpl) {
			setTimeout(function() {
				o(Error("already ended"));
			}, 0);
			return;
		}
		try {
			return s.rpcImpl(t, r[s.requestDelimited ? "encodeDelimited" : "encode"](a).finish(), function(e, n) {
				if (e) return s.emit("error", e, t), o(e);
				if (n === null) {
					s.end(!0);
					return;
				}
				if (!(n instanceof i)) try {
					n = i[s.responseDelimited ? "decodeDelimited" : "decode"](n);
				} catch (e) {
					return s.emit("error", e, t), o(e);
				}
				return s.emit("data", n, t), o(null, n);
			});
		} catch (e) {
			s.emit("error", e, t), setTimeout(function() {
				o(e);
			}, 0);
			return;
		}
	}, r.prototype.end = function(e) {
		return this.rpcImpl && (e || this.rpcImpl(null, null, null), this.rpcImpl = null, this.emit("end").off()), this;
	};
})), j = /* @__PURE__ */ o(((e) => {
	var t = e;
	t.Service = A();
})), M = /* @__PURE__ */ o(((e, t) => {
	t.exports = {};
})), ee = /* @__PURE__ */ o(((e) => {
	var t = e;
	t.build = "minimal", t.Writer = E(), t.BufferWriter = D(), t.Reader = O(), t.BufferReader = k(), t.util = T(), t.rpc = j(), t.roots = M(), t.configure = n;
	/* istanbul ignore next */
	function n() {
		t.util._configure(), t.Writer._configure(t.BufferWriter), t.Reader._configure(t.BufferReader);
	}
	n();
})), N = /* @__PURE__ */ c((/* @__PURE__ */ o(((e, t) => {
	t.exports = ee();
})))(), 1), P = N.default.Reader, F = N.default.util, I = N.default.roots.default || (N.default.roots.default = {}), L = I.com = (() => {
	let e = {};
	return e.opensource = (function() {
		let e = {};
		return e.svga = (function() {
			let e = {};
			return e.MovieParams = (function() {
				function e(e) {
					if (e) for (var t = Object.keys(e), n = 0; n < t.length; ++n) e[t[n]] != null && t[n] !== "__proto__" && (this[t[n]] = e[t[n]]);
				}
				return e.prototype.viewBoxWidth = 0, e.prototype.viewBoxHeight = 0, e.prototype.fps = 0, e.prototype.frames = 0, e.decode = function(e, t, n, r, i) {
					if (e instanceof P || (e = P.create(e)), r === void 0 && (r = 0), r > P.recursionLimit) throw Error("max depth exceeded");
					for (var a = t === void 0 ? e.len : e.pos + t, o = i || new I.com.opensource.svga.MovieParams(), s; e.pos < a;) {
						var c = e.pos, l = e.tag();
						if (l === n) {
							n = void 0;
							break;
						}
						var u = l & 7;
						switch (l >>>= 3) {
							case 1:
								if (u !== 5) break;
								(s = e.float()) === 0 ? delete o.viewBoxWidth : o.viewBoxWidth = s;
								continue;
							case 2:
								if (u !== 5) break;
								(s = e.float()) === 0 ? delete o.viewBoxHeight : o.viewBoxHeight = s;
								continue;
							case 3:
								if (u !== 0) break;
								(s = e.int32()) ? o.fps = s : delete o.fps;
								continue;
							case 4:
								if (u !== 0) break;
								(s = e.int32()) ? o.frames = s : delete o.frames;
								continue;
						}
						e.skipType(u, r, l), F.makeProp(o, "$unknowns", !1), (o.$unknowns ||= []).push(e.raw(c, e.pos));
					}
					if (n !== void 0) throw Error("missing end group");
					return o;
				}, e.getTypeUrl = function(e) {
					return e === void 0 && (e = "type.googleapis.com"), e + "/com.opensource.svga.MovieParams";
				}, e;
			})(), e.SpriteEntity = (function() {
				function e(e) {
					if (this.frames = [], e) for (var t = Object.keys(e), n = 0; n < t.length; ++n) e[t[n]] != null && t[n] !== "__proto__" && (this[t[n]] = e[t[n]]);
				}
				return e.prototype.imageKey = "", e.prototype.frames = F.emptyArray, e.prototype.matteKey = "", e.decode = function(e, t, n, r, i) {
					if (e instanceof P || (e = P.create(e)), r === void 0 && (r = 0), r > P.recursionLimit) throw Error("max depth exceeded");
					for (var a = t === void 0 ? e.len : e.pos + t, o = i || new I.com.opensource.svga.SpriteEntity(), s; e.pos < a;) {
						var c = e.pos, l = e.tag();
						if (l === n) {
							n = void 0;
							break;
						}
						var u = l & 7;
						switch (l >>>= 3) {
							case 1:
								if (u !== 2) break;
								(s = e.string()).length ? o.imageKey = s : delete o.imageKey;
								continue;
							case 2:
								if (u !== 2) break;
								o.frames && o.frames.length || (o.frames = []), o.frames.push(I.com.opensource.svga.FrameEntity.decode(e, e.uint32(), void 0, r + 1));
								continue;
							case 3:
								if (u !== 2) break;
								(s = e.string()).length ? o.matteKey = s : delete o.matteKey;
								continue;
						}
						e.skipType(u, r, l), F.makeProp(o, "$unknowns", !1), (o.$unknowns ||= []).push(e.raw(c, e.pos));
					}
					if (n !== void 0) throw Error("missing end group");
					return o;
				}, e.getTypeUrl = function(e) {
					return e === void 0 && (e = "type.googleapis.com"), e + "/com.opensource.svga.SpriteEntity";
				}, e;
			})(), e.AudioEntity = (function() {
				function e(e) {
					if (e) for (var t = Object.keys(e), n = 0; n < t.length; ++n) e[t[n]] != null && t[n] !== "__proto__" && (this[t[n]] = e[t[n]]);
				}
				return e.prototype.audioKey = "", e.prototype.startFrame = 0, e.prototype.endFrame = 0, e.prototype.startTime = 0, e.prototype.totalTime = 0, e.decode = function(e, t, n, r, i) {
					if (e instanceof P || (e = P.create(e)), r === void 0 && (r = 0), r > P.recursionLimit) throw Error("max depth exceeded");
					for (var a = t === void 0 ? e.len : e.pos + t, o = i || new I.com.opensource.svga.AudioEntity(), s; e.pos < a;) {
						var c = e.pos, l = e.tag();
						if (l === n) {
							n = void 0;
							break;
						}
						var u = l & 7;
						switch (l >>>= 3) {
							case 1:
								if (u !== 2) break;
								(s = e.string()).length ? o.audioKey = s : delete o.audioKey;
								continue;
							case 2:
								if (u !== 0) break;
								(s = e.int32()) ? o.startFrame = s : delete o.startFrame;
								continue;
							case 3:
								if (u !== 0) break;
								(s = e.int32()) ? o.endFrame = s : delete o.endFrame;
								continue;
							case 4:
								if (u !== 0) break;
								(s = e.int32()) ? o.startTime = s : delete o.startTime;
								continue;
							case 5:
								if (u !== 0) break;
								(s = e.int32()) ? o.totalTime = s : delete o.totalTime;
								continue;
						}
						e.skipType(u, r, l), F.makeProp(o, "$unknowns", !1), (o.$unknowns ||= []).push(e.raw(c, e.pos));
					}
					if (n !== void 0) throw Error("missing end group");
					return o;
				}, e.getTypeUrl = function(e) {
					return e === void 0 && (e = "type.googleapis.com"), e + "/com.opensource.svga.AudioEntity";
				}, e;
			})(), e.Layout = (function() {
				function e(e) {
					if (e) for (var t = Object.keys(e), n = 0; n < t.length; ++n) e[t[n]] != null && t[n] !== "__proto__" && (this[t[n]] = e[t[n]]);
				}
				return e.prototype.x = 0, e.prototype.y = 0, e.prototype.width = 0, e.prototype.height = 0, e.decode = function(e, t, n, r, i) {
					if (e instanceof P || (e = P.create(e)), r === void 0 && (r = 0), r > P.recursionLimit) throw Error("max depth exceeded");
					for (var a = t === void 0 ? e.len : e.pos + t, o = i || new I.com.opensource.svga.Layout(), s; e.pos < a;) {
						var c = e.pos, l = e.tag();
						if (l === n) {
							n = void 0;
							break;
						}
						var u = l & 7;
						switch (l >>>= 3) {
							case 1:
								if (u !== 5) break;
								(s = e.float()) === 0 ? delete o.x : o.x = s;
								continue;
							case 2:
								if (u !== 5) break;
								(s = e.float()) === 0 ? delete o.y : o.y = s;
								continue;
							case 3:
								if (u !== 5) break;
								(s = e.float()) === 0 ? delete o.width : o.width = s;
								continue;
							case 4:
								if (u !== 5) break;
								(s = e.float()) === 0 ? delete o.height : o.height = s;
								continue;
						}
						e.skipType(u, r, l), F.makeProp(o, "$unknowns", !1), (o.$unknowns ||= []).push(e.raw(c, e.pos));
					}
					if (n !== void 0) throw Error("missing end group");
					return o;
				}, e.getTypeUrl = function(e) {
					return e === void 0 && (e = "type.googleapis.com"), e + "/com.opensource.svga.Layout";
				}, e;
			})(), e.Transform = (function() {
				function e(e) {
					if (e) for (var t = Object.keys(e), n = 0; n < t.length; ++n) e[t[n]] != null && t[n] !== "__proto__" && (this[t[n]] = e[t[n]]);
				}
				return e.prototype.a = 0, e.prototype.b = 0, e.prototype.c = 0, e.prototype.d = 0, e.prototype.tx = 0, e.prototype.ty = 0, e.decode = function(e, t, n, r, i) {
					if (e instanceof P || (e = P.create(e)), r === void 0 && (r = 0), r > P.recursionLimit) throw Error("max depth exceeded");
					for (var a = t === void 0 ? e.len : e.pos + t, o = i || new I.com.opensource.svga.Transform(), s; e.pos < a;) {
						var c = e.pos, l = e.tag();
						if (l === n) {
							n = void 0;
							break;
						}
						var u = l & 7;
						switch (l >>>= 3) {
							case 1:
								if (u !== 5) break;
								(s = e.float()) === 0 ? delete o.a : o.a = s;
								continue;
							case 2:
								if (u !== 5) break;
								(s = e.float()) === 0 ? delete o.b : o.b = s;
								continue;
							case 3:
								if (u !== 5) break;
								(s = e.float()) === 0 ? delete o.c : o.c = s;
								continue;
							case 4:
								if (u !== 5) break;
								(s = e.float()) === 0 ? delete o.d : o.d = s;
								continue;
							case 5:
								if (u !== 5) break;
								(s = e.float()) === 0 ? delete o.tx : o.tx = s;
								continue;
							case 6:
								if (u !== 5) break;
								(s = e.float()) === 0 ? delete o.ty : o.ty = s;
								continue;
						}
						e.skipType(u, r, l), F.makeProp(o, "$unknowns", !1), (o.$unknowns ||= []).push(e.raw(c, e.pos));
					}
					if (n !== void 0) throw Error("missing end group");
					return o;
				}, e.getTypeUrl = function(e) {
					return e === void 0 && (e = "type.googleapis.com"), e + "/com.opensource.svga.Transform";
				}, e;
			})(), e.ShapeEntity = (function() {
				function e(e) {
					if (e) for (var t = Object.keys(e), n = 0; n < t.length; ++n) e[t[n]] != null && t[n] !== "__proto__" && (this[t[n]] = e[t[n]]);
				}
				e.prototype.type = 0, e.prototype.shape = null, e.prototype.rect = null, e.prototype.ellipse = null, e.prototype.styles = null, e.prototype.transform = null;
				let t;
				return Object.defineProperty(e.prototype, "args", {
					get: F.oneOfGetter(t = [
						"shape",
						"rect",
						"ellipse"
					]),
					set: F.oneOfSetter(t)
				}), e.decode = function(e, t, n, r, i) {
					if (e instanceof P || (e = P.create(e)), r === void 0 && (r = 0), r > P.recursionLimit) throw Error("max depth exceeded");
					for (var a = t === void 0 ? e.len : e.pos + t, o = i || new I.com.opensource.svga.ShapeEntity(), s; e.pos < a;) {
						var c = e.pos, l = e.tag();
						if (l === n) {
							n = void 0;
							break;
						}
						var u = l & 7;
						switch (l >>>= 3) {
							case 1:
								if (u !== 0) break;
								(s = e.int32()) ? o.type = s : delete o.type;
								continue;
							case 2:
								if (u !== 2) break;
								o.shape = I.com.opensource.svga.ShapeEntity.ShapeArgs.decode(e, e.uint32(), void 0, r + 1, o.shape), o.args = "shape";
								continue;
							case 3:
								if (u !== 2) break;
								o.rect = I.com.opensource.svga.ShapeEntity.RectArgs.decode(e, e.uint32(), void 0, r + 1, o.rect), o.args = "rect";
								continue;
							case 4:
								if (u !== 2) break;
								o.ellipse = I.com.opensource.svga.ShapeEntity.EllipseArgs.decode(e, e.uint32(), void 0, r + 1, o.ellipse), o.args = "ellipse";
								continue;
							case 10:
								if (u !== 2) break;
								o.styles = I.com.opensource.svga.ShapeEntity.ShapeStyle.decode(e, e.uint32(), void 0, r + 1, o.styles);
								continue;
							case 11:
								if (u !== 2) break;
								o.transform = I.com.opensource.svga.Transform.decode(e, e.uint32(), void 0, r + 1, o.transform);
								continue;
						}
						e.skipType(u, r, l), F.makeProp(o, "$unknowns", !1), (o.$unknowns ||= []).push(e.raw(c, e.pos));
					}
					if (n !== void 0) throw Error("missing end group");
					return o;
				}, e.getTypeUrl = function(e) {
					return e === void 0 && (e = "type.googleapis.com"), e + "/com.opensource.svga.ShapeEntity";
				}, e.ShapeType = (function() {
					let e = {}, t = Object.create(e);
					return t[e[0] = "SHAPE"] = 0, t[e[1] = "RECT"] = 1, t[e[2] = "ELLIPSE"] = 2, t[e[3] = "KEEP"] = 3, t;
				})(), e.ShapeArgs = (function() {
					function e(e) {
						if (e) for (var t = Object.keys(e), n = 0; n < t.length; ++n) e[t[n]] != null && t[n] !== "__proto__" && (this[t[n]] = e[t[n]]);
					}
					return e.prototype.d = "", e.decode = function(e, t, n, r, i) {
						if (e instanceof P || (e = P.create(e)), r === void 0 && (r = 0), r > P.recursionLimit) throw Error("max depth exceeded");
						for (var a = t === void 0 ? e.len : e.pos + t, o = i || new I.com.opensource.svga.ShapeEntity.ShapeArgs(), s; e.pos < a;) {
							var c = e.pos, l = e.tag();
							if (l === n) {
								n = void 0;
								break;
							}
							var u = l & 7;
							switch (l >>>= 3) {
								case 1:
									if (u !== 2) break;
									(s = e.string()).length ? o.d = s : delete o.d;
									continue;
							}
							e.skipType(u, r, l), F.makeProp(o, "$unknowns", !1), (o.$unknowns ||= []).push(e.raw(c, e.pos));
						}
						if (n !== void 0) throw Error("missing end group");
						return o;
					}, e.getTypeUrl = function(e) {
						return e === void 0 && (e = "type.googleapis.com"), e + "/com.opensource.svga.ShapeEntity.ShapeArgs";
					}, e;
				})(), e.RectArgs = (function() {
					function e(e) {
						if (e) for (var t = Object.keys(e), n = 0; n < t.length; ++n) e[t[n]] != null && t[n] !== "__proto__" && (this[t[n]] = e[t[n]]);
					}
					return e.prototype.x = 0, e.prototype.y = 0, e.prototype.width = 0, e.prototype.height = 0, e.prototype.cornerRadius = 0, e.decode = function(e, t, n, r, i) {
						if (e instanceof P || (e = P.create(e)), r === void 0 && (r = 0), r > P.recursionLimit) throw Error("max depth exceeded");
						for (var a = t === void 0 ? e.len : e.pos + t, o = i || new I.com.opensource.svga.ShapeEntity.RectArgs(), s; e.pos < a;) {
							var c = e.pos, l = e.tag();
							if (l === n) {
								n = void 0;
								break;
							}
							var u = l & 7;
							switch (l >>>= 3) {
								case 1:
									if (u !== 5) break;
									(s = e.float()) === 0 ? delete o.x : o.x = s;
									continue;
								case 2:
									if (u !== 5) break;
									(s = e.float()) === 0 ? delete o.y : o.y = s;
									continue;
								case 3:
									if (u !== 5) break;
									(s = e.float()) === 0 ? delete o.width : o.width = s;
									continue;
								case 4:
									if (u !== 5) break;
									(s = e.float()) === 0 ? delete o.height : o.height = s;
									continue;
								case 5:
									if (u !== 5) break;
									(s = e.float()) === 0 ? delete o.cornerRadius : o.cornerRadius = s;
									continue;
							}
							e.skipType(u, r, l), F.makeProp(o, "$unknowns", !1), (o.$unknowns ||= []).push(e.raw(c, e.pos));
						}
						if (n !== void 0) throw Error("missing end group");
						return o;
					}, e.getTypeUrl = function(e) {
						return e === void 0 && (e = "type.googleapis.com"), e + "/com.opensource.svga.ShapeEntity.RectArgs";
					}, e;
				})(), e.EllipseArgs = (function() {
					function e(e) {
						if (e) for (var t = Object.keys(e), n = 0; n < t.length; ++n) e[t[n]] != null && t[n] !== "__proto__" && (this[t[n]] = e[t[n]]);
					}
					return e.prototype.x = 0, e.prototype.y = 0, e.prototype.radiusX = 0, e.prototype.radiusY = 0, e.decode = function(e, t, n, r, i) {
						if (e instanceof P || (e = P.create(e)), r === void 0 && (r = 0), r > P.recursionLimit) throw Error("max depth exceeded");
						for (var a = t === void 0 ? e.len : e.pos + t, o = i || new I.com.opensource.svga.ShapeEntity.EllipseArgs(), s; e.pos < a;) {
							var c = e.pos, l = e.tag();
							if (l === n) {
								n = void 0;
								break;
							}
							var u = l & 7;
							switch (l >>>= 3) {
								case 1:
									if (u !== 5) break;
									(s = e.float()) === 0 ? delete o.x : o.x = s;
									continue;
								case 2:
									if (u !== 5) break;
									(s = e.float()) === 0 ? delete o.y : o.y = s;
									continue;
								case 3:
									if (u !== 5) break;
									(s = e.float()) === 0 ? delete o.radiusX : o.radiusX = s;
									continue;
								case 4:
									if (u !== 5) break;
									(s = e.float()) === 0 ? delete o.radiusY : o.radiusY = s;
									continue;
							}
							e.skipType(u, r, l), F.makeProp(o, "$unknowns", !1), (o.$unknowns ||= []).push(e.raw(c, e.pos));
						}
						if (n !== void 0) throw Error("missing end group");
						return o;
					}, e.getTypeUrl = function(e) {
						return e === void 0 && (e = "type.googleapis.com"), e + "/com.opensource.svga.ShapeEntity.EllipseArgs";
					}, e;
				})(), e.ShapeStyle = (function() {
					function e(e) {
						if (e) for (var t = Object.keys(e), n = 0; n < t.length; ++n) e[t[n]] != null && t[n] !== "__proto__" && (this[t[n]] = e[t[n]]);
					}
					return e.prototype.fill = null, e.prototype.stroke = null, e.prototype.strokeWidth = 0, e.prototype.lineCap = 0, e.prototype.lineJoin = 0, e.prototype.miterLimit = 0, e.prototype.lineDashI = 0, e.prototype.lineDashII = 0, e.prototype.lineDashIII = 0, e.decode = function(e, t, n, r, i) {
						if (e instanceof P || (e = P.create(e)), r === void 0 && (r = 0), r > P.recursionLimit) throw Error("max depth exceeded");
						for (var a = t === void 0 ? e.len : e.pos + t, o = i || new I.com.opensource.svga.ShapeEntity.ShapeStyle(), s; e.pos < a;) {
							var c = e.pos, l = e.tag();
							if (l === n) {
								n = void 0;
								break;
							}
							var u = l & 7;
							switch (l >>>= 3) {
								case 1:
									if (u !== 2) break;
									o.fill = I.com.opensource.svga.ShapeEntity.ShapeStyle.RGBAColor.decode(e, e.uint32(), void 0, r + 1, o.fill);
									continue;
								case 2:
									if (u !== 2) break;
									o.stroke = I.com.opensource.svga.ShapeEntity.ShapeStyle.RGBAColor.decode(e, e.uint32(), void 0, r + 1, o.stroke);
									continue;
								case 3:
									if (u !== 5) break;
									(s = e.float()) === 0 ? delete o.strokeWidth : o.strokeWidth = s;
									continue;
								case 4:
									if (u !== 0) break;
									(s = e.int32()) ? o.lineCap = s : delete o.lineCap;
									continue;
								case 5:
									if (u !== 0) break;
									(s = e.int32()) ? o.lineJoin = s : delete o.lineJoin;
									continue;
								case 6:
									if (u !== 5) break;
									(s = e.float()) === 0 ? delete o.miterLimit : o.miterLimit = s;
									continue;
								case 7:
									if (u !== 5) break;
									(s = e.float()) === 0 ? delete o.lineDashI : o.lineDashI = s;
									continue;
								case 8:
									if (u !== 5) break;
									(s = e.float()) === 0 ? delete o.lineDashII : o.lineDashII = s;
									continue;
								case 9:
									if (u !== 5) break;
									(s = e.float()) === 0 ? delete o.lineDashIII : o.lineDashIII = s;
									continue;
							}
							e.skipType(u, r, l), F.makeProp(o, "$unknowns", !1), (o.$unknowns ||= []).push(e.raw(c, e.pos));
						}
						if (n !== void 0) throw Error("missing end group");
						return o;
					}, e.getTypeUrl = function(e) {
						return e === void 0 && (e = "type.googleapis.com"), e + "/com.opensource.svga.ShapeEntity.ShapeStyle";
					}, e.RGBAColor = (function() {
						function e(e) {
							if (e) for (var t = Object.keys(e), n = 0; n < t.length; ++n) e[t[n]] != null && t[n] !== "__proto__" && (this[t[n]] = e[t[n]]);
						}
						return e.prototype.r = 0, e.prototype.g = 0, e.prototype.b = 0, e.prototype.a = 0, e.decode = function(e, t, n, r, i) {
							if (e instanceof P || (e = P.create(e)), r === void 0 && (r = 0), r > P.recursionLimit) throw Error("max depth exceeded");
							for (var a = t === void 0 ? e.len : e.pos + t, o = i || new I.com.opensource.svga.ShapeEntity.ShapeStyle.RGBAColor(), s; e.pos < a;) {
								var c = e.pos, l = e.tag();
								if (l === n) {
									n = void 0;
									break;
								}
								var u = l & 7;
								switch (l >>>= 3) {
									case 1:
										if (u !== 5) break;
										(s = e.float()) === 0 ? delete o.r : o.r = s;
										continue;
									case 2:
										if (u !== 5) break;
										(s = e.float()) === 0 ? delete o.g : o.g = s;
										continue;
									case 3:
										if (u !== 5) break;
										(s = e.float()) === 0 ? delete o.b : o.b = s;
										continue;
									case 4:
										if (u !== 5) break;
										(s = e.float()) === 0 ? delete o.a : o.a = s;
										continue;
								}
								e.skipType(u, r, l), F.makeProp(o, "$unknowns", !1), (o.$unknowns ||= []).push(e.raw(c, e.pos));
							}
							if (n !== void 0) throw Error("missing end group");
							return o;
						}, e.getTypeUrl = function(e) {
							return e === void 0 && (e = "type.googleapis.com"), e + "/com.opensource.svga.ShapeEntity.ShapeStyle.RGBAColor";
						}, e;
					})(), e.LineCap = (function() {
						let e = {}, t = Object.create(e);
						return t[e[0] = "LineCap_BUTT"] = 0, t[e[1] = "LineCap_ROUND"] = 1, t[e[2] = "LineCap_SQUARE"] = 2, t;
					})(), e.LineJoin = (function() {
						let e = {}, t = Object.create(e);
						return t[e[0] = "LineJoin_MITER"] = 0, t[e[1] = "LineJoin_ROUND"] = 1, t[e[2] = "LineJoin_BEVEL"] = 2, t;
					})(), e;
				})(), e;
			})(), e.FrameEntity = (function() {
				function e(e) {
					if (this.shapes = [], e) for (var t = Object.keys(e), n = 0; n < t.length; ++n) e[t[n]] != null && t[n] !== "__proto__" && (this[t[n]] = e[t[n]]);
				}
				return e.prototype.alpha = 0, e.prototype.layout = null, e.prototype.transform = null, e.prototype.clipPath = "", e.prototype.shapes = F.emptyArray, e.decode = function(e, t, n, r, i) {
					if (e instanceof P || (e = P.create(e)), r === void 0 && (r = 0), r > P.recursionLimit) throw Error("max depth exceeded");
					for (var a = t === void 0 ? e.len : e.pos + t, o = i || new I.com.opensource.svga.FrameEntity(), s; e.pos < a;) {
						var c = e.pos, l = e.tag();
						if (l === n) {
							n = void 0;
							break;
						}
						var u = l & 7;
						switch (l >>>= 3) {
							case 1:
								if (u !== 5) break;
								(s = e.float()) === 0 ? delete o.alpha : o.alpha = s;
								continue;
							case 2:
								if (u !== 2) break;
								o.layout = I.com.opensource.svga.Layout.decode(e, e.uint32(), void 0, r + 1, o.layout);
								continue;
							case 3:
								if (u !== 2) break;
								o.transform = I.com.opensource.svga.Transform.decode(e, e.uint32(), void 0, r + 1, o.transform);
								continue;
							case 4:
								if (u !== 2) break;
								(s = e.string()).length ? o.clipPath = s : delete o.clipPath;
								continue;
							case 5:
								if (u !== 2) break;
								o.shapes && o.shapes.length || (o.shapes = []), o.shapes.push(I.com.opensource.svga.ShapeEntity.decode(e, e.uint32(), void 0, r + 1));
								continue;
						}
						e.skipType(u, r, l), F.makeProp(o, "$unknowns", !1), (o.$unknowns ||= []).push(e.raw(c, e.pos));
					}
					if (n !== void 0) throw Error("missing end group");
					return o;
				}, e.getTypeUrl = function(e) {
					return e === void 0 && (e = "type.googleapis.com"), e + "/com.opensource.svga.FrameEntity";
				}, e;
			})(), e.MovieEntity = (function() {
				function e(e) {
					if (this.images = {}, this.sprites = [], this.audios = [], e) for (var t = Object.keys(e), n = 0; n < t.length; ++n) e[t[n]] != null && t[n] !== "__proto__" && (this[t[n]] = e[t[n]]);
				}
				return e.prototype.version = "", e.prototype.params = null, e.prototype.images = F.emptyObject, e.prototype.sprites = F.emptyArray, e.prototype.audios = F.emptyArray, e.decode = function(e, t, n, r, i) {
					if (e instanceof P || (e = P.create(e)), r === void 0 && (r = 0), r > P.recursionLimit) throw Error("max depth exceeded");
					for (var a = t === void 0 ? e.len : e.pos + t, o = i || new I.com.opensource.svga.MovieEntity(), s, c; e.pos < a;) {
						var l = e.pos, u = e.tag();
						if (u === n) {
							n = void 0;
							break;
						}
						var d = u & 7;
						switch (u >>>= 3) {
							case 1:
								if (d !== 2) break;
								(c = e.string()).length ? o.version = c : delete o.version;
								continue;
							case 2:
								if (d !== 2) break;
								o.params = I.com.opensource.svga.MovieParams.decode(e, e.uint32(), void 0, r + 1, o.params);
								continue;
							case 3:
								if (d !== 2) break;
								o.images === F.emptyObject && (o.images = {});
								var f = e.uint32() + e.pos;
								for (s = "", c = []; e.pos < f;) {
									var p = e.tag();
									switch (d = p & 7, p >>>= 3) {
										case 1:
											if (d !== 2) break;
											s = e.string();
											continue;
										case 2:
											if (d !== 2) break;
											c = e.bytes();
											continue;
									}
									e.skipType(d, r, p);
								}
								s === "__proto__" && F.makeProp(o.images, s), o.images[s] = c;
								continue;
							case 4:
								if (d !== 2) break;
								o.sprites && o.sprites.length || (o.sprites = []), o.sprites.push(I.com.opensource.svga.SpriteEntity.decode(e, e.uint32(), void 0, r + 1));
								continue;
							case 5:
								if (d !== 2) break;
								o.audios && o.audios.length || (o.audios = []), o.audios.push(I.com.opensource.svga.AudioEntity.decode(e, e.uint32(), void 0, r + 1));
								continue;
						}
						e.skipType(d, r, u), F.makeProp(o, "$unknowns", !1), (o.$unknowns ||= []).push(e.raw(l, e.pos));
					}
					if (n !== void 0) throw Error("missing end group");
					return o;
				}, e.getTypeUrl = function(e) {
					return e === void 0 && (e = "type.googleapis.com"), e + "/com.opensource.svga.MovieEntity";
				}, e;
			})(), e;
		})(), e;
	})(), e;
})(), R = L.opensource.svga, te = class e {
	static {
		this.lastShapes = [];
	}
	constructor(t) {
		if (this.shapes = [], this.alpha = t.alpha || 0, this.layout = {
			x: t.layout?.x || 0,
			y: t.layout?.y || 0,
			width: t.layout?.width || 0,
			height: t.layout?.height || 0
		}, this.transform = {
			a: t.transform?.a || 1,
			b: t.transform?.b || 0,
			c: t.transform?.c || 0,
			d: t.transform?.d || 1,
			tx: t.transform?.tx || 0,
			ty: t.transform?.ty || 0
		}, this.clipPath = t.clipPath || null, t.shapes) if (t.shapes[0] && t.shapes[0].type === R.ShapeEntity.ShapeType.KEEP) this.shapes = e.lastShapes;
		else {
			let n = t.shapes.map((e) => {
				if (Object.prototype.hasOwnProperty.call(e, "type") || Object.defineProperty(e, "type", {
					value: e.type,
					enumerable: !0
				}), e.styles) {
					if (e.styles.fill) {
						let { r: t, g: n, b: r, a: i } = e.styles.fill;
						e.styles.fillStr = `rgba(${parseInt((t * 255).toString())}, ${parseInt((n * 255).toString())}, ${parseInt((r * 255).toString())}, ${i})`;
					}
					if (e.styles.stroke) {
						let { r: t, g: n, b: r, a: i } = e.styles.stroke;
						e.styles.strokeStr = `rgba(${parseInt((t * 255).toString())}, ${parseInt((n * 255).toString())}, ${parseInt((r * 255).toString())}, ${i})`;
					}
					switch (e.styles.lineJoin) {
						case R.ShapeEntity.ShapeStyle.LineJoin.LineJoin_MITER:
							e.styles.lineJoinStr = "miter";
							break;
						case R.ShapeEntity.ShapeStyle.LineJoin.LineJoin_ROUND:
							e.styles.lineJoinStr = "round";
							break;
						case R.ShapeEntity.ShapeStyle.LineJoin.LineJoin_BEVEL:
							e.styles.lineJoinStr = "bevel";
							break;
					}
					switch (e.styles.lineCap) {
						case R.ShapeEntity.ShapeStyle.LineCap.LineCap_BUTT:
							e.styles.lineCapStr = "butt";
							break;
						case R.ShapeEntity.ShapeStyle.LineCap.LineCap_ROUND:
							e.styles.lineCapStr = "round";
							break;
						case R.ShapeEntity.ShapeStyle.LineCap.LineCap_SQUARE:
							e.styles.lineCapStr = "square";
							break;
					}
				}
				return e;
			});
			e.lastShapes = n, this.shapes = n;
		}
	}
}, z = class {
	constructor(e, t, n) {
		this.videoSize = {
			width: 0,
			height: 0
		}, this.images = {}, this.audios = {}, this.dynamicElements = {}, this.sprites = [], this.version = e.version, this.videoSize.width = e.params?.viewBoxWidth || 0, this.videoSize.height = e.params?.viewBoxHeight || 0, this.FPS = e.params?.fps || 20, this.frames = e.params?.frames || 0, this.sprites = e.sprites.map(({ imageKey: e = null, frames: t }) => ({
			imageKey: e,
			frames: (t || []).map((e) => new te(e))
		})), this.images = t, this.audios = n;
	}
}, B = class e {
	static {
		this.destroying = !1;
	}
	static {
		this.usageNO = 1;
	}
	static {
		this.workingCount = 0;
	}
	constructor() {
		e.ensureWorker();
	}
	static ensureWorker() {
		return this.worker = this.worker || new p(), this.destroying = !1, this.worker;
	}
	static destroyWorker() {
		this.worker?.terminate(), this.worker = null, this.destroying = !1;
	}
	do(t) {
		if (h(new Uint8Array(t, 0, 4)) === m.VERSION_1) throw Error("this parser does not support version@1.x of svga.");
		if (!t) throw Error("Parser Data not found");
		return new Promise((n) => {
			let r = e.ensureWorker(), i = e.usageNO++, a = ({ data: { result: t, id: o } }) => {
				o === i && (n(t), r.removeEventListener("message", a), e.workingCount--, e.destroying && this.destroy());
			};
			e.workingCount++, r.addEventListener("message", a), r.postMessage({
				data: t,
				id: i
			}, [t]);
		});
	}
	destroy() {
		if (e.worker !== null) {
			if (e.workingCount > 0) {
				e.destroying = !0;
				return;
			}
			e.destroyWorker();
		}
	}
};
//#endregion
//#region src/player/path/index.ts
function V(e, t) {
	t && (e.strokeStyle = t?.strokeStr || "transparent", t && (e.lineWidth = t.strokeWidth, e.lineCap = t.lineCapStr, e.lineJoin = t.lineJoinStr, e.miterLimit = t.miterLimit), e.fillStyle = t?.fillStr || "transparent", (t.lineDashI || t.lineDashII || t.lineDashIII) && e.setLineDash([
		t.lineDashI ? t.lineDashI : 0,
		t.lineDashII ? t.lineDashII : 0,
		t.lineDashIII ? t.lineDashIII : 0
	]));
}
function H(e, t) {
	t && e.transform(t.a || 1, t.b || 0, t.c || 0, t.d || 1, t.tx || 0, t.ty || 0);
}
//#endregion
//#region src/player/path/ellipse-path.ts
function U(e, t) {
	e.save(), V(e, t.styles), H(e, t.transform);
	let n = t.x - t.radiusX, r = t.y - t.radiusY, i = t.radiusX * 2, a = t.radiusY * 2, o = .5522848, s = i / 2 * o, c = a / 2 * o, l = n + i, u = r + a, d = n + i / 2, f = r + a / 2;
	e.beginPath(), e.moveTo(n, f), e.bezierCurveTo(n, f - c, d - s, r, d, r), e.bezierCurveTo(d + s, r, l, f - c, l, f), e.bezierCurveTo(l, f + c, d + s, u, d, u), e.bezierCurveTo(d - s, u, n, f + c, n, f), t.styles?.fill && e.fill(), t.styles?.stroke && e.stroke(), e.restore();
}
//#endregion
//#region src/player/path/rect-path.ts
function W(e, t) {
	e.save(), V(e, t.styles), H(e, t.transform);
	let n = t.x, r = t.y, i = t.width, a = t.height, o = t.cornerRadius;
	i < 2 * o && (o = i / 2), a < 2 * o && (o = a / 2), e.beginPath(), e.moveTo(n + o, r), e.arcTo(n + i, r, n + i, r + a, o), e.arcTo(n + i, r + a, n, r + a, o), e.arcTo(n, r + a, n, r, o), e.arcTo(n, r, n + i, r, o), e.closePath(), t.styles?.fill && e.fill(), t.styles?.stroke && e.stroke(), e.restore();
}
//#endregion
//#region src/player/path/bezier-path.ts
var G = /* @__PURE__ */ function(e) {
	return e.M = "M", e.m = "m", e.L = "L", e.l = "l", e.H = "H", e.h = "h", e.V = "V", e.v = "v", e.C = "C", e.c = "c", e.S = "S", e.s = "s", e.Q = "Q", e.q = "q", e.A = "A", e.a = "a", e.Z = "Z", e.z = "z", e;
}(G || {});
function K(e, t) {
	e.save(), V(e, t.styles), H(e, t.transform);
	let n = {
		x: 0,
		y: 0,
		x1: 0,
		y1: 0,
		x2: 0,
		y2: 0
	};
	e.beginPath(), t.d.replace(/([a-zA-Z])/g, "|||$1 ").replace(/,/g, " ").split("|||").forEach((t) => {
		t.length != 0 && q(e, n, t.substr(0, 1), t.substr(1).trim().split(" "));
	}), t.styles?.fill && e.fill(), t.styles?.stroke && e.stroke(), e.restore();
}
function q(e, t, n, r) {
	switch (n) {
		case G.M:
			t.x = Number(r[0]), t.y = Number(r[1]), e.moveTo(t.x, t.y);
			break;
		case G.m:
			t.x += Number(r[0]), t.y += Number(r[1]), e.moveTo(t.x, t.y);
			break;
		case G.L:
			t.x = Number(r[0]), t.y = Number(r[1]), e.lineTo(t.x, t.y);
			break;
		case G.l:
			t.x += Number(r[0]), t.y += Number(r[1]), e.lineTo(t.x, t.y);
			break;
		case G.H:
			t.x = Number(r[0]), e.lineTo(t.x, t.y);
			break;
		case G.h:
			t.x += Number(r[0]), e.lineTo(t.x, t.y);
			break;
		case G.V:
			t.y = Number(r[0]), e.lineTo(t.x, t.y);
			break;
		case G.v:
			t.y += Number(r[0]), e.lineTo(t.x, t.y);
			break;
		case G.C:
			t.x1 = Number(r[0]), t.y1 = Number(r[1]), t.x2 = Number(r[2]), t.y2 = Number(r[3]), t.x = Number(r[4]), t.y = Number(r[5]), e.bezierCurveTo(t.x1, t.y1, t.x2, t.y2, t.x, t.y);
			break;
		case G.c:
			t.x1 = t.x + Number(r[0]), t.y1 = t.y + Number(r[1]), t.x2 = t.x + Number(r[2]), t.y2 = t.y + Number(r[3]), t.x += Number(r[4]), t.y += Number(r[5]), e.bezierCurveTo(t.x1, t.y1, t.x2, t.y2, t.x, t.y);
			break;
		case G.S:
			t.x1 && t.y1 && t.x2 && t.y2 ? (t.x1 = t.x - t.x2 + t.x, t.y1 = t.y - t.y2 + t.y, t.x2 = Number(r[0]), t.y2 = Number(r[1]), t.x = Number(r[2]), t.y = Number(r[3]), e.bezierCurveTo(t.x1, t.y1, t.x2, t.y2, t.x, t.y)) : (t.x1 = Number(r[0]), t.y1 = Number(r[1]), t.x = Number(r[2]), t.y = Number(r[3]), e.quadraticCurveTo(t.x1, t.y1, t.x, t.y));
			break;
		case G.s:
			t.x1 && t.y1 && t.x2 && t.y2 ? (t.x1 = t.x - t.x2 + t.x, t.y1 = t.y - t.y2 + t.y, t.x2 = t.x + Number(r[0]), t.y2 = t.y + Number(r[1]), t.x += Number(r[2]), t.y += Number(r[3]), e.bezierCurveTo(t.x1, t.y1, t.x2, t.y2, t.x, t.y)) : (t.x1 = t.x + Number(r[0]), t.y1 = t.y + Number(r[1]), t.x += Number(r[2]), t.y += Number(r[3]), e.quadraticCurveTo(t.x1, t.y1, t.x, t.y));
			break;
		case G.Q:
			t.x1 = Number(r[0]), t.y1 = Number(r[1]), t.x = Number(r[2]), t.y = Number(r[3]), e.quadraticCurveTo(t.x1, t.y1, t.x, t.y);
			break;
		case G.q:
			t.x1 = t.x + Number(r[0]), t.y1 = t.y + Number(r[1]), t.x += Number(r[2]), t.y += Number(r[3]), e.quadraticCurveTo(t.x1, t.y1, t.x, t.y);
			break;
		case G.A: break;
		case G.a: break;
		case G.Z:
		case G.z:
			e.closePath();
			break;
		default: break;
	}
}
//#endregion
//#region src/player/offscreen.canvas.render.ts
var J = L.opensource.svga;
function Y(e, t, n, r, i) {
	let a = e.getContext("2d");
	return a === null ? (console.error("svga render fail, 2d context null"), e) : (r.forEach((e) => {
		let r = e.frames[i];
		if (r.alpha < .05) return;
		a.save(), a.globalAlpha = r.alpha, a.transform(r.transform.a || 1, r.transform.b || 0, r.transform.c || 0, r.transform.d || 1, r.transform.tx || 0, r.transform.ty || 0);
		let o = e.imageKey && t[e.imageKey];
		o && (r.clipPath && (K(a, { d: r.clipPath }), a.clip()), o instanceof Image ? a.drawImage(o, 0, 0, o.width, o.height) : a.drawImage(o, 0, 0));
		let s = e.imageKey && n[e.imageKey];
		if (s) {
			let { source: e, fit: t } = "fit" in s ? s : {
				source: s,
				fit: "none"
			}, n, i;
			switch (e instanceof HTMLImageElement ? (n = e.naturalWidth, i = e.naturalHeight) : e instanceof HTMLVideoElement ? (n = e.videoWidth, i = e.videoHeight) : e instanceof SVGImageElement ? (n = e.width.baseVal.value, i = e.height.baseVal.value) : e instanceof VideoFrame ? (n = e.codedWidth, i = e.codedHeight) : (n = e.width, i = e.height), t) {
				case "contain": {
					let t = r.layout.width / n, o = r.layout.height / i, s = Math.min(t, o), c = s * n, l = s * i;
					a.drawImage(e, (r.layout.width - c) / 2, (r.layout.height - l) / 2, c, l);
					break;
				}
				case "cover": {
					let t = r.layout.width / n, o = r.layout.height / i, s = Math.max(t, o), c = s * n, l = s * i;
					a.drawImage(e, (r.layout.width - c) / 2, (r.layout.height - l) / 2, c, l);
					break;
				}
				case "fill":
					a.drawImage(e, 0, 0, r.layout.width, r.layout.height);
					break;
				default:
					a.drawImage(e, (r.layout.width - n) / 2, (r.layout.height - i) / 2);
					break;
			}
		}
		r.shapes?.forEach((e) => {
			e.type === J.ShapeEntity.ShapeType.SHAPE && e.shape && e.shape.d ? K(a, {
				d: e.shape.d,
				transform: e.transform,
				styles: e.styles
			}) : e.type === J.ShapeEntity.ShapeType.ELLIPSE && e.ellipse ? U(a, {
				x: e.ellipse.x || 0,
				y: e.ellipse.y || 0,
				radiusX: e.ellipse.radiusX || 0,
				radiusY: e.ellipse.radiusY || 0,
				transform: e.transform,
				styles: e.styles
			}) : e.type === J.ShapeEntity.ShapeType.RECT && e.rect && W(a, {
				x: e.rect.x || 0,
				y: e.rect.y || 0,
				width: e.rect.width || 0,
				height: e.rect.height || 0,
				cornerRadius: e.rect.cornerRadius || 0,
				transform: e.transform,
				styles: e.styles
			});
		}), a.restore();
	}), e);
}
//#endregion
//#region src/player/renderer.ts
function X() {
	"createImageBitmap" in window || Object.assign(window, { createImageBitmap: async function(e) {
		return new Promise((t, n) => {
			let r = document.createElement("img");
			r.addEventListener("load", function() {
				t(this);
			}), r.addEventListener("error", function(e) {
				n(e);
			}), r.src = URL.createObjectURL(e);
		});
	} });
}
var ne = class {
	constructor(e) {
		this.audios = [], this.audioConfigs = {}, this.isCacheFrame = !1, this.frameCache = {}, X(), this.target = e, this.offscreenCanvas = window.OffscreenCanvas ? new window.OffscreenCanvas(e.width, e.height) : document.createElement("canvas");
	}
	async prepare(e) {
		this.audios = [], this.audioConfigs = {}, this.target.width !== e.videoSize.width && (this.target.width = e.videoSize.width), this.target.height !== e.videoSize.height && (this.target.height = e.videoSize.height);
		let t = (e, t) => {
			let n = this.audioConfigs[e] || [];
			n.push(t), this.audioConfigs[e] = n;
		}, n = Object.entries(e.images).map(async ([t, n]) => {
			if (n instanceof ArrayBuffer) {
				let r = new Blob([n], { type: "image/png" }), i = await createImageBitmap(r);
				e.images[t] = i;
			}
			return n;
		}), r = Object.values(e.audios).map(({ source: e, startFrame: n, endFrame: r, audioKey: i, startTime: a, totalTime: o }) => new Promise((s) => {
			let c = new Audio(URL.createObjectURL(new Blob([new Uint8Array(e)], { type: "audio/x-mpeg" }))), l = {
				audioKey: i,
				audio: c,
				startFrame: n,
				endFrame: r,
				startTime: a,
				totalTime: o
			};
			t(n, l), t(r, l), this.audios.push(c), c.onloadeddata = s, c.load();
		}));
		await Promise.all([...r, ...n]);
	}
	processAudio(e) {
		let t = this.audioConfigs[e];
		!t || t.length === 0 || t.forEach(function(t) {
			if (t.startFrame === e) {
				t.audio.currentTime = t.startTime, t.audio.play();
				return;
			}
			if (t.endFrame === e) {
				t.audio.pause(), t.audio.currentTime = 0;
				return;
			}
		});
	}
	clear() {
		this.target.getContext("2d")?.clearRect(0, 0, this.target.width, this.target.height);
	}
	drawFrame(e, t, n, r) {
		let i = this.target.getContext("2d");
		if (!i) return;
		if (i.clearRect(0, 0, this.target.width, this.target.height), this.isCacheFrame && this.frameCache[r]) {
			let e = this.frameCache[r];
			i.drawImage(e, 0, 0);
			return;
		}
		let a = this.offscreenCanvas;
		a.width = this.target.width, a.height = this.target.height, Y(a, e, n, t, r), i.drawImage(a, 0, 0), this.isCacheFrame && createImageBitmap(a).then((e) => {
			this.frameCache[r] = e;
		});
	}
	pauseAllAudio() {
		this.audios.forEach(function(e) {
			e.pause();
		});
	}
	resumeAllAudio() {
		this.audios.forEach(function(e) {
			e.play();
		});
	}
	stopAllAudio() {
		this.audios.forEach(function(e) {
			e.pause(), e.currentTime = 0;
		});
	}
};
//#endregion
//#region src/player/noop.ts
function Z() {}
//#endregion
//#region src/player/animator.ts
var re = "onmessage = function () {\n  setTimeout(function() {postMessage(null)}, 1 / 60)\n}", Q = /* @__PURE__ */ function(e) {
	return e.FORWARDS = "forwards", e.BACKWARDS = "backwards", e;
}({}), ie = class e {
	constructor() {
		this.noExecutionDelay = !1, this.startValue = 0, this.endValue = 0, this.duration = 0, this.repeatNumber = 1, this.loop = !1, this.fillRule = Q.FORWARDS, this.onUpdate = Z, this.onEnd = Z, this.isRunning = !1, this.startTimestamp = 0, this.timeoutWorker = null, this.doFrame = () => {
			let t = e.currentTimeMillisecond() - this.startTimestamp, n;
			!this.loop && t >= this.duration * this.repeatNumber ? (n = this.fillRule === Q.BACKWARDS ? 0 : 1, this.isRunning = !1) : n = t % this.duration / this.duration;
			let r = (this.endValue - this.startValue) * n + this.startValue;
			this.onUpdate(r), this.isRunning ? this.timeoutWorker ? (this.timeoutWorker.onmessage = this.doFrame, this.timeoutWorker.postMessage(null)) : window.requestAnimationFrame(this.doFrame) : (this.timeoutWorker !== null && (this.timeoutWorker.terminate(), this.timeoutWorker = null), this.onEnd());
		};
	}
	static currentTimeMillisecond() {
		return performance ? performance.now() : (/* @__PURE__ */ new Date()).getTime();
	}
	start(t) {
		this.isRunning = !0, this.startTimestamp = e.currentTimeMillisecond(), t && (this.startTimestamp -= t / (this.endValue - this.startValue) * this.duration), this.noExecutionDelay && this.timeoutWorker === null && (this.timeoutWorker = new Worker(window.URL.createObjectURL(new Blob([re])))), this.doFrame();
	}
	stop() {
		this.isRunning = !1, this.timeoutWorker !== null && (this.timeoutWorker.terminate(), this.timeoutWorker = null);
	}
}, ae = /* @__PURE__ */ function(e) {
	return e.START = "start", e.PROCESS = "process", e.PAUSE = "pause", e.RESUME = "resume", e.STOP = "stop", e.END = "end", e.CLEAR = "clear", e;
}({}), $ = /* @__PURE__ */ function(e) {
	return e.FORWARDS = "forwards", e.FALLBACKS = "fallbacks", e;
}({}), oe = class {
	constructor(e, t, n) {
		if (this.currentFrame = 0, this.videoItem = null, this.playMode = $.FORWARDS, this.startFrame = 0, this.endFrame = 0, this.intersectionObserverRenderShow = !0, this.intersectionObserver = null, this.$onEvent = {
			start: Z,
			process: Z,
			pause: Z,
			resume: Z,
			stop: Z,
			end: Z,
			clear: Z
		}, this.container = typeof e == "string" ? document.body.querySelector(e) : e, !this.container) throw Error("container undefined.");
		if (!this.container.getContext) throw Error("container should be HTMLCanvasElement.");
		this.renderer = new ne(this.container), this.animator = new ie(), t && this.mount(t), n && this.set(n);
	}
	get progress() {
		return this.videoItem ? (this.currentFrame + 1) / this.videoItem.frames * 100 : 0;
	}
	set({ loop: e = !0, fillMode: t = Q.FORWARDS, playMode: n = $.FORWARDS, startFrame: r = 0, endFrame: i = 0, cacheFrames: a = !1, intersectionObserverRender: o = !1, noExecutionDelay: s = !1 }) {
		this.playMode = n, this.startFrame = r, this.endFrame = i, this.handleIntersectionObserver(o), this.setAnimatorLoop(e), this.animator.fillRule = t, this.animator.noExecutionDelay = s, this.renderer.isCacheFrame = a;
	}
	mount(e) {
		return this.currentFrame = 0, this.videoItem = e, this.renderer.prepare(e);
	}
	start() {
		if (!this.videoItem) throw Error("video item undefined.");
		this.startAnimation(this.videoItem), this.$onEvent.start();
	}
	resume() {
		this.animator.start(this.currentFrame), this.renderer.resumeAllAudio(), this.$onEvent.resume();
	}
	pause() {
		this.animator.stop(), this.renderer.pauseAllAudio(), this.$onEvent.pause();
	}
	stop() {
		this.animator.stop(), this.renderer.clear(), this.currentFrame = 0, this.renderer.stopAllAudio(), this.$onEvent.stop();
	}
	clear() {
		this.animator.stop(), this.renderer.clear(), this.renderer.stopAllAudio(), this.$onEvent.clear();
	}
	destroy() {
		this.animator.stop(), this.renderer.clear(), this.renderer.stopAllAudio(), this.currentFrame = 0, this.videoItem = null;
	}
	$on(e, t) {
		return this.$onEvent[e] = t, e === "end" && (this.animator.onEnd = () => this.$onEvent.end()), this;
	}
	handleIntersectionObserver(e) {
		typeof window < "u" && "IntersectionObserver" in window && e ? (this.intersectionObserver = new IntersectionObserver((e) => {
			this.intersectionObserverRenderShow = e[0]?.intersectionRatio > 0;
		}, {
			rootMargin: "0px",
			threshold: [
				0,
				.5,
				1
			]
		}), this.intersectionObserver.observe(this.container)) : (this.intersectionObserver && this.intersectionObserver.disconnect(), this.intersectionObserverRenderShow = !0);
	}
	setAnimatorLoop(e) {
		switch (typeof e) {
			case "boolean":
				this.animator.loop = e;
				break;
			case "number": e <= 0 ? (console.warn("[svga-web] set loop to 0 is deprecated, use \"loop: true\" instead"), this.animator.loop = !0) : (this.animator.loop = !1, this.animator.repeatNumber = e);
		}
	}
	startAnimation({ images: e, sprites: t, frames: n, FPS: r, dynamicElements: i }) {
		let { playMode: a, startFrame: o, endFrame: s } = this, c = n - 1;
		this.currentFrame === c && (this.currentFrame = o || 0), this.animator.startValue = a === $.FALLBACKS ? s || c : o || 0, this.animator.endValue = a === $.FALLBACKS ? o || 0 : s || c, s > 0 && s > o ? n = s - o : s <= 0 && o > 0 && (n -= o), this.animator.duration = 1 / r * n * 1e3, this.animator.onUpdate = (n) => {
			n = Math.floor(n), this.currentFrame !== n && (this.playMode === $.FORWARDS && this.renderer.processAudio(n), this.currentFrame = n, this.intersectionObserverRenderShow && this.renderer.drawFrame(e, t, i, this.currentFrame), this.$onEvent.process());
		}, this.playMode === $.FORWARDS && this.renderer.processAudio(0), this.animator.start(this.currentFrame);
	}
}, se = "2.4.4", ce = class {
	constructor({ name: e, storeName: t } = {
		name: "svga-web." + se,
		storeName: "svga_file"
	}) {
		this.storeName = t, this.dbPromise = new Promise(function(n, r) {
			if (window.indexedDB) {
				let i = window.indexedDB.open(e);
				i.onerror = function(e) {
					r(/* @__PURE__ */ Error("[svgaWeb.DB] indexedDB open fail" + e));
				}, i.onsuccess = function() {
					n(i.result);
				}, i.onupgradeneeded = function() {
					let e = i.result;
					e.objectStoreNames.contains(t) || e.createObjectStore(t);
				};
			} else throw Error("[svgaWeb.DB] indexedDB not supported");
		});
	}
	async find(e) {
		return this.dbPromise.then((t) => new Promise((n) => {
			let r = t.transaction([this.storeName], "readonly").objectStore(this.storeName).get(e);
			r.onsuccess = () => n(r.result);
		}));
	}
	async insert(e, t) {
		return this.dbPromise.then((n) => new Promise((r) => {
			let i = n.transaction([this.storeName], "readwrite");
			i.objectStore(this.storeName).put(t, e), i.oncomplete = r;
		}));
	}
	async delete(e) {
		return this.dbPromise.then((t) => new Promise((n) => {
			let r = t.transaction([this.storeName], "readwrite").objectStore(this.storeName).delete(e);
			r.onsuccess = n;
		}));
	}
};
//#endregion
export { ce as DB, u as Downloader, ae as EVENT_TYPES, Q as FILL_MODE, $ as PLAY_MODE, B as Parser, oe as Player, m as Version, z as VideoEntity, h as getVersion };
