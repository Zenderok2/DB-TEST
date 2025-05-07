<template>
    <div>
      <AppHeader>
        <template #right>
          <button @click="goToRegister">Зарегистрироваться</button>
        </template>
      </AppHeader>
  
      <section id="login">
        <div class="login-container">
          <h2>Авторизация</h2>
          <form @submit.prevent="handleLogin">
            <div class="form-group">
              <label for="username">Логин или почта</label>
              <input
                v-model.trim="username"
                type="text"
                id="username"
                placeholder="Введите ваш логин или почту"
                required
                autofocus
              />
            </div>
  
            <div class="form-group">
              <label for="password">Пароль</label>
              <input
                v-model="password"
                type="password"
                id="password"
                placeholder="Введите ваш пароль"
                required
              />
            </div>
  
            <button :disabled="loading" class="login-button">
              {{ loading ? 'Входим...' : 'Войти' }}
            </button>
          </form>
        </div>
      </section>
  
      <div class="modal" v-if="modal">
        <div class="modal-content">
          <h2>Для бронирования необходимо зарегистрироваться</h2>
          <button @click="goToRegister">Зарегистрироваться</button>
          <button class="close" @click="closeModal">Закрыть</button>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue'
  import { useRouter } from 'vue-router'
  import AppHeader from '@/components/AppHeader.vue'
  
  const username = ref('')
  const password = ref('')
  const loading = ref(false)
  const modal = ref(false)
  
  const router = useRouter()
  
  function showModal()
  {
    modal.value = true
  }
  
  function closeModal()
  {
    modal.value = false
  }
  
  function goToRegister()
  {
    router.push('/register')
  }
  
  async function handleLogin()
  {
    if (!username.value || !password.value) return
  
    loading.value = true
  
    try
    {
      const res = await fetch('http://176.108.251.188:3000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.value,
          password: password.value
        })
      })
  
      const data = await res.json()
  
      if (!res.ok)
        throw new Error(data.message || 'Ошибка авторизации')
  
      localStorage.setItem('token', data.token)
      localStorage.setItem('loggedInUser', JSON.stringify(data.user))
  
      alert('Вход выполнен успешно!')
      router.push('/profile')
    }
    catch (err)
    {
      alert('Ошибка: ' + err.message)
    }
    finally
    {
      loading.value = false
    }
  }
  </script>
  
  <style scoped>
  
  </style>
  