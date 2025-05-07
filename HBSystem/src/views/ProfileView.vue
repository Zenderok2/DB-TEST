<template>
  <div>
    <AppHeader>
      <template #right>
        <button @click="goHome">Главная</button>
        <button @click="logout">Выйти</button>
      </template>
    </AppHeader>

    <main class="profile-container">
      <section class="profile-card">
        <h2><i class="fas fa-user-circle"></i> Профиль пользователя</h2>

        <div class="info-item">
          <label><i class="fas fa-id-card"></i> ФИО:</label>
          <span>{{ fullname || 'Загрузка...' }}</span>
        </div>
        <div class="info-item">
          <label><i class="fas fa-envelope"></i> Email:</label>
          <span>{{ email || 'Загрузка...' }}</span>
        </div>
        <div class="info-item">
          <label><i class="fas fa-birthday-cake"></i> Дата рождения:</label>
          <span>{{ dateofbirth || 'Загрузка...' }}</span>
        </div>
        <div class="info-item">
          <label><i class="fas fa-phone"></i> Телефон:</label>
          <span>{{ phone || 'Загрузка...' }}</span>
        </div>

        <div class="info-item" v-if="booking">
          <hr>
          <h3><i class="fas fa-hotel"></i> Активное бронирование</h3>
          <p>Отель: {{ booking.hotel_name }}</p>
          <p>Номер: №{{ booking.room_number }}</p>
          <p>С {{ formatDate(booking.checkindate) }} по {{ formatDate(booking.checkoutdate) }}</p>
          <p>Сумма: {{ booking.total_price }} ₽ с учётом сервисного сбора</p>
          <button @click="cancelBooking">Отменить бронирование</button>
        </div>

        <div class="info-item" v-else>
          <hr>
          <p><i class="fas fa-info-circle"></i> У вас нет активных бронирований.</p>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'

const router = useRouter()

const fullname = ref('')
const email = ref('')
const dateofbirth = ref('')
const phone = ref('')
const booking = ref(null)

function goHome()
{
  router.push('/')
}

function logout()
{
  localStorage.removeItem('token')
  localStorage.removeItem('loggedInUser')
  router.push('/login')
}

function formatDate(date)
{
  return new Date(date).toISOString().split('T')[0]
}

async function loadProfile()
{
  const token = localStorage.getItem('token')
  if (!token)
  {
    router.push('/login')
    return
  }

  try
  {
    const res = await fetch('http://176.108.251.188:3000/profile', {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!res.ok)
      throw new Error('Ошибка загрузки данных')

    const user = await res.json()

    fullname.value = user.fullname || ''
    email.value = user.email || ''
    dateofbirth.value = user.dateofbirth?.split('T')[0] || ''
    phone.value = user.phone || ''
  }
  catch (err)
  {
    alert(`Ошибка: ${err.message}`)
    router.push('/login')
  }
}

async function loadBooking()
{
  const token = localStorage.getItem('token')
  if (!token) return

  try
  {
    const res = await fetch('http://176.108.251.188:3000/myBooking', {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (res.ok)
      booking.value = await res.json()
  }
  catch (err)
  {
    console.error('Ошибка получения брони:', err)
  }
}

async function cancelBooking()
{
  const token = localStorage.getItem('token')
  if (!token || !booking.value) return

  if (!confirm('Вы уверены, что хотите отменить бронирование?')) return

  try
  {
    const res = await fetch(`http://176.108.251.188:3000/cancelBooking/${booking.value.booking_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })

    const result = await res.json()

    if (!res.ok)
      throw new Error(result.message)

    alert('Бронирование отменено.')
    booking.value = null
  }
  catch (err)
  {
    alert('Ошибка: ' + err.message)
  }
}

onMounted(() => {
  loadProfile()
  loadBooking()
})
</script>

<style scoped>
.profile-container {
  padding: 30px;
  display: flex;
  justify-content: center;
}

.profile-card {
  background: white;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 600px;
}

.profile-card h2 {
  text-align: center;
  margin-bottom: 30px;
  font-size: 1.8rem;
  color: #333;
}

.info-item {
  margin-bottom: 20px;
}

.info-item label {
  display: block;
  font-weight: bold;
  color: #555;
  margin-bottom: 5px;
}

.info-item span {
  font-size: 1rem;
  color: #222;
}

hr {
  margin: 20px 0;
}
</style>
