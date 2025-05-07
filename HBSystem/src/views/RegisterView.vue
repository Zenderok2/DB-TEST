<template>
  <div>
    <AppHeader>
      <template #right>
        <button @click="goToLogin">Войти</button>
      </template>
    </AppHeader>
    <section id="register">
      <div class="register-container">
        <h2>Регистрация</h2>
        <form @submit.prevent="registerUser">
          <div class="form-group" v-for="field in fields" :key="field.key">
            <label>{{ field.label }}</label>
            <input
              :type="field.type"
              v-model="field.model.value"
              :placeholder="field.placeholder"
              :class="{ invalid: errors[field.key] }"
              @blur="field.validate"
            />
            <div class="error-message" v-if="errors[field.key]">
              {{ errors[field.key] }}
            </div>
          </div>

          <button type="submit" class="register-button" :disabled="!isFormValid">
            Зарегистрироваться
          </button>
        </form>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'

const router = useRouter()

const fullname = ref('')
const phone = ref('')
const dob = ref('')
const email = ref('')
const username = ref('')
const password = ref('')

const errors = ref({
  fullname: '',
  phone: '',
  dob: '',
  email: '',
  password: ''
})

function goToLogin() {
  router.push('/login')
}

function validateFullName() {
  const parts = fullname.value.trim().split(/\s+/)
  if (parts.length < 2)
    return (errors.value.fullname = 'Введите ФИО (не менее 2 слов)')

  for (const p of parts) {
    if (p.length < 2)
      return (errors.value.fullname = 'Каждая часть ≥ 2 символов')
    if (!/^[а-яА-ЯёЁa-zA-Z-]+$/.test(p))
      return (errors.value.fullname = 'Имя содержит только буквы и дефис')
  }

  errors.value.fullname = ''
}

function validatePhone() {
  const digits = phone.value.replace(/\D/g, '')
  errors.value.phone = digits.length === 11 && /^([78])/.test(digits)
    ? ''
    : 'Формат: +7XXXXXXXXXX или 8XXXXXXXXXX'
}

function validateDob() {
  if (!dob.value)
    return (errors.value.dob = 'Введите дату рождения')

  const d = new Date(dob.value)
  const age = new Date().getFullYear() - d.getFullYear()
  errors.value.dob = age >= 18 ? '' : 'Вам должно быть ≥ 18 лет'
}

function validateEmail() {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  errors.value.email = re.test(email.value) ? '' : 'Некорректный email'
}

function validatePassword() {
  const p = password.value
  if (p.length < 8)
    return (errors.value.password = 'Мин. 8 символов')
  if (!/[!@#$%^&*]/.test(p))
    return (errors.value.password = 'Добавьте спецсимвол')
  errors.value.password = ''
}

const fields = [
  { key: 'fullname', label: 'ФИО', model: fullname, type: 'text', validate: validateFullName },
  { key: 'phone', label: 'Телефон', model: phone, type: 'tel', validate: validatePhone },
  { key: 'dob', label: 'Дата рождения', model: dob, type: 'date', validate: validateDob },
  { key: 'email', label: 'Email', model: email, type: 'email', validate: validateEmail },
  { key: 'username', label: 'Логин', model: username, type: 'text', validate: () => {} },
  { key: 'password', label: 'Пароль', model: password, type: 'password', validate: validatePassword }
]

const isFormValid = computed(() =>
  fullname.value && !errors.value.fullname &&
  phone.value && !errors.value.phone &&
  dob.value && !errors.value.dob &&
  email.value && !errors.value.email &&
  username.value &&
  password.value && !errors.value.password
)

async function registerUser() {
  fields.forEach(f => f.validate())
  if (!isFormValid.value) {
    alert('Проверьте форму')
    return
  }

  try {
    const res = await fetch('http://176.108.251.188:3000/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullname: fullname.value,
        phone: phone.value,
        dob: dob.value,
        email: email.value,
        username: username.value,
        password: password.value
      })
    })

    if (!res.ok)
      throw new Error(await res.text())

    alert('Регистрация прошла успешно!')
    router.push('/login')
  } catch (err) {
    alert('Ошибка: ' + err.message)
  }
}
</script>

<style scoped>
.error-message {
  color: red;
  font-size: 12px;
  margin-top: 4px;
}

input.invalid {
  border-color: red;
}
</style>
