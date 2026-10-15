<script setup>
import { nextTick, ref, watch } from 'vue';
import { Eye, EyeOff, X } from '@lucide/vue';
import SaturnLogo from './SaturnLogo.vue';
import { checkCommunityConnection, communityHealthUrl, useCommunityStore } from '../communityClient.js';
const props = defineProps({ open: Boolean });
const emit = defineEmits(['update:open', 'success']);
const store=useCommunityStore();
const dialog=ref(null), mode=ref('login'), username=ref(''), password=ref(''), confirmation=ref(''), show=ref(false), error=ref(''), busy=ref(false);
const connectionHelp=ref(false);
const checking=ref(false), diagnosis=ref('');
let diagnosisSequence=0;
function resetDiagnosis(){diagnosisSequence++;diagnosis.value='';checking.value=false;}
watch(() => props.open, async open => { await nextTick(); if(open&&!dialog.value.open){error.value='';connectionHelp.value=false;resetDiagnosis();dialog.value.showModal();} else if(!open&&dialog.value.open)dialog.value.close(); });
function close(){ if(busy.value)return; emit('update:open',false); }
function switchMode(value){mode.value=value;error.value='';connectionHelp.value=false;resetDiagnosis();confirmation.value='';}
async function diagnose(){
  const sequence=++diagnosisSequence;
  checking.value=true;diagnosis.value='';
  try {
    const result=await checkCommunityConnection();
    if(sequence!==diagnosisSequence)return;
    const labels={ok:'正常',http:'接口错误',network:'连接失败',timeout:'连接超时'};
    diagnosis.value=[`网页：${result.origin}`,`社区：${result.service}`,...result.checks.map(check=>`${check.label}：${labels[check.status]}${check.httpStatus?`（${check.httpStatus}）`:''}`)].join('\n');
  } finally {if(sequence===diagnosisSequence)checking.value=false;}
}
async function submit(){
  error.value='';
  connectionHelp.value=false;
  resetDiagnosis();
  if(mode.value==='register'&&password.value!==confirmation.value){error.value='两次输入的密码不一致。';return;}
  busy.value=true;
  try { const credentials={username:username.value.trim(),password:password.value}; const user=await (mode.value==='register'?store.register(credentials):store.login(credentials));password.value='';confirmation.value='';emit('success',user);emit('update:open',false); }
  catch(failure){error.value=failure.message;connectionHelp.value=['COMMUNITY_NETWORK','COMMUNITY_TIMEOUT','COMMUNITY_ENDPOINT'].includes(failure.code);}
  finally{busy.value=false;}
}
</script>
<template>
  <dialog ref="dialog" class="xingyu-account-dialog" aria-labelledby="account-dialog-title" @cancel.prevent="close" @click="$event.target===dialog && close()" @close="emit('update:open',false)">
    <button class="xingyu-icon-button account-close" aria-label="关闭登录窗口" :disabled="busy" @click="close"><X :size="22"/></button>
    <SaturnLogo :size="67"/><h2 id="account-dialog-title">{{mode==='login'?'欢迎回到星语':'加入星语社区'}}</h2><p>记录星空，和同样好奇的人相遇。</p>
    <div class="account-mode-tabs"><button :class="{active:mode==='login'}" :disabled="busy" @click="switchMode('login')">账号登录</button><button :class="{active:mode==='register'}" :disabled="busy" @click="switchMode('register')">注册账号</button></div>
    <form @submit.prevent="submit">
      <label>用户名<input v-model="username" autofocus autocomplete="username" required minlength="2" maxlength="24" placeholder="你的用户名" :disabled="busy"/></label>
      <label>密码<div class="account-password"><input v-model="password" :type="show?'text':'password'" :autocomplete="mode==='register'?'new-password':'current-password'" required minlength="8" maxlength="128" placeholder="至少 8 个字符" :disabled="busy"/><button class="xingyu-icon-button" type="button" :aria-label="show?'隐藏密码':'显示密码'" @click="show=!show"><EyeOff v-if="show" :size="18"/><Eye v-else :size="18"/></button></div></label>
      <label v-if="mode==='register'">确认密码<input v-model="confirmation" :type="show?'text':'password'" autocomplete="new-password" required minlength="8" maxlength="128" placeholder="再输入一次密码" :disabled="busy"/></label>
      <p v-if="error" class="account-error" role="alert">{{error}}</p>
      <div v-if="connectionHelp" class="account-error"><a :href="communityHealthUrl" target="_blank" rel="noopener noreferrer">打开服务检查页 ↗</a> <button type="button" :disabled="checking" @click="diagnose">{{checking?'正在检查…':'检查连接'}}</button><pre v-if="diagnosis" style="white-space:pre-wrap;overflow-wrap:anywhere">{{diagnosis}}</pre></div>
      <button class="account-submit" type="submit" :disabled="busy">{{busy?'正在连接…':mode==='register'?'注册并登录':'登录'}}</button>
    </form>
    <p v-if="store.state.mode==='preview'" class="account-preview-note">当前为独立预览社区，账号和内容保存在本版预览服务。</p>
  </dialog>
</template>
