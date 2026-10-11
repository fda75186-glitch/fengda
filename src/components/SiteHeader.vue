<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Search, Menu, X, ChevronDown, LogOut, Bookmark, Plus } from '@lucide/vue';
import SaturnLogo from './SaturnLogo.vue';
const props = defineProps({ routes: Array, route: String, user: Object, searchItems: { type: Array, default: () => [] } });
const emit = defineEmits(['navigate', 'publish', 'login', 'logout', 'select-search']);
const menu = ref(false), account = ref(false), searching = ref(false), query = ref(''), searchInput = ref(null), header = ref(null);
const results = computed(() => query.value.trim() ? props.searchItems.filter(item => `${item.label} ${item.description || ''}`.toLowerCase().includes(query.value.trim().toLowerCase())).slice(0, 8) : []);
function go(route) { menu.value = false; account.value = false; searching.value = false; emit('navigate', route); }
function choose(item) { searching.value = false; emit('select-search', item); }
function outside(event) { if (!header.value?.contains(event.target)) { account.value = false; searching.value = false; } }
function escape(event) { if (event.key === 'Escape') { searching.value = false; account.value = false; menu.value = false; } }
watch(() => props.route, () => { menu.value = false; account.value = false; });
watch(searching,async open=>{if(open){await nextTick();searchInput.value?.focus()}});
onMounted(() => { document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape); });
onBeforeUnmount(() => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); });
</script>
<template>
  <header ref="header" class="xingyu-header">
    <div class="xingyu-header-inner">
      <a class="xingyu-brand" href="#home" @click.prevent="go('home')"><SaturnLogo :size="48"/><span>星语<small>STARWHISPER</small></span></a>
      <nav class="xingyu-nav" aria-label="主导航"><a v-for="item in routes" :key="item.id" :href="`#${item.id}`" :class="{active:route===item.id}" :aria-current="route===item.id?'page':undefined" @click.prevent="go(item.id)">{{ item.label }}</a></nav>
      <div class="xingyu-header-actions">
        <button class="xingyu-icon-button xingyu-search-trigger" aria-label="全站搜索" :aria-expanded="searching" @click="searching=!searching"><Search :size="20"/></button>
        <button class="xingyu-publish-button" @click="emit('publish')"><Plus :size="17"/><span>发布内容</span></button>
        <div class="xingyu-account-area">
          <button v-if="!user" class="xingyu-login-button" @click="emit('login')">登录</button>
          <button v-else class="xingyu-user-button" :aria-expanded="account" aria-label="打开账号菜单" @click="account=!account"><img v-if="user.avatar" :src="user.avatar" :alt="user.name"/><SaturnLogo v-else :size="35"/><span>{{ user.name }}</span><ChevronDown :size="14"/></button>
          <div v-if="account && user" class="xingyu-account-menu"><strong>{{ user.name }}</strong><button @click="go('notebook')"><Bookmark :size="16"/>我的星空</button><button @click="go('publish')"><Plus :size="16"/>我的草稿与创作</button><button @click="account=false;emit('logout')"><LogOut :size="16"/>退出登录</button></div>
        </div>
        <button class="xingyu-icon-button xingyu-menu-toggle" aria-label="打开导航菜单" :aria-expanded="menu" @click="menu=!menu"><X v-if="menu" :size="22"/><Menu v-else :size="22"/></button>
      </div>
    </div>
    <nav v-if="menu" class="xingyu-mobile-nav" aria-label="移动导航"><a v-for="item in routes" :key="item.id" :href="`#${item.id}`" :class="{active:route===item.id}" @click.prevent="go(item.id)">{{ item.label }}</a><a href="#notebook" @click.prevent="go('notebook')">我的星空</a><button @click="menu=false;searching=true">全站搜索</button></nav>
    <div v-if="searching" class="xingyu-global-search">
      <form @submit.prevent="results.length && choose(results[0])"><Search :size="23"/><input ref="searchInput" v-model="query" autofocus type="search" aria-label="全站搜索关键词" placeholder="搜索天体、科普知识、社区话题…"/><button class="xingyu-icon-button" type="button" aria-label="关闭搜索" @click="searching=false"><X :size="20"/></button></form>
      <div v-if="query.trim()" class="xingyu-search-results"><button v-for="item in results" :key="item.kind+item.id" @click="choose(item)"><span>{{ item.kind==='article'?'科普知识':'社区内容' }}</span><strong>{{ item.label }}</strong><small>{{ item.description }}</small></button><p v-if="!results.length">没有找到相关内容，试试“月球”“土星”或“观星”。</p></div><p v-else class="xingyu-search-tip">输入关键词，搜索科普内容与社区讨论。</p>
    </div>
  </header>
</template>
