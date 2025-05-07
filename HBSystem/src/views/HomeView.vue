<template>
  <div>
    <header>
      <img :src="logo" alt="Логотип" />
      <h1>Looking-hotel — лучший сайт для бронирования отелей!</h1>
      <div id="auth">
        <button v-if="!isAuth" @click="goToLogin">Войти</button>
        <button v-if="!isAuth" @click="goToRegister">Зарегистрироваться</button>
        <button v-if="isAuth" @click="goToProf">Личный кабинет</button>
      </div>
      <nav>
        <ul>
          <li><RouterLink to="/"><i class="fas fa-home"></i> Главная</RouterLink></li>
          <li><a href="#" @click="openModal"><i class="fas fa-hotel"></i> Бронь отеля</a></li>
          <li><a href="#" @click="openModal"><i class="fas fa-map-marked-alt"></i> Бронь экскурсии</a></li>
        </ul>
      </nav>
    </header>

    <div class="container">
      <section id="hotels">
        <h2>Доступные отели</h2>
        <div class="hotel-carousel">
          <button class="carousel-button prev" @click="prevHotel" :disabled="curHI === 0">
            <i class="fas fa-chevron-left"></i>
          </button>

          <transition name="fade" mode="out-in">
            <HotelCard
              :key="hotels[curHI].id"
              :hotel="hotels[curHI]"
              @book="openModal"
            />
          </transition>

          <button class="carousel-button next" @click="nextHotel" :disabled="curHI === hotels.length - 1">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </section>
    </div>

    <div class="modal" v-if="isMod">
      <div class="modal-content">
        <template v-if="isAuth">
          <h2>Бронирование отеля</h2>

          <label>Выберите отель:</label>
          <select v-model="selectedHotel">
            <option v-for="h in hotels" :value="h.id">{{ h.name }}</option>
          </select>

          <label>Выберите тип номера:</label>
          <div class="room-selector">
            <label v-for="room in availableRooms" :key="room.room_number">
              <input
                type="radio"
                name="roomType"
                :value="room"
                v-model="selectedRoom"
              />
              {{ room.status }} №{{ room.room_number }} — {{ room.price }} руб/ночь
            </label>
          </div>

          <div class="date-picker">
            <label>Дата заезда:</label>
            <input type="date" v-model="checkInDate" :min="minCheckInDate" @change="updateCheckOutLimits" />
            <label>Дата выезда:</label>
            <input type="date" v-model="checkOutDate" :min="checkInDate" :max="maxCheckOutDate" />
          </div>

          <button @click="bookHotel">Подтвердить</button>
          <button class="close" @click="closeModal">Закрыть</button>
        </template>

        <template v-else>
          <h2>Для бронирования необходимо зарегистрироваться</h2>
          <button @click="goToRegister">Зарегистрироваться</button>
          <button class="close" @click="closeModal">Закрыть</button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import HotelCard from '@/components/HotelCard.vue'
import hotel1 from '@/assets/hotel1.jpg'
import hotel2 from '@/assets/hotel2.jpg'
import hotel3 from '@/assets/hotel3.jpg'
import hotel4 from '@/assets/hotel4.jpg'
import hotel5 from '@/assets/hotel5.jpg'
import hotel6 from '@/assets/hotel6.jpg'
import logo from '@/assets/Looking-hotel.png'

const isAuth = ref(!!localStorage.getItem('token'))
const router = useRouter()

function goToLogin() {
  router.push('/login')
}
function goToRegister() {
  router.push('/register')
}
function goToProf() {
  router.push('/profile')
}

const isMod = ref(false)
function openModal() {
  isMod.value = true
}
function closeModal() {
  isMod.value = false
}

const hotels = ref([
  {
    id: 1,
    name: 'Отель Москва',
    images: [hotel1, hotel2],
    descr: 'Отель в центре Москвы с прекрасным видом на Кремль.',
    rooms: [
      { type: 'Люкс', price: 5000 },
      { type: 'Эконом', price: 2500 }
    ]
  },
  {
    id: 2,
    name: 'Санкт-Петербург',
    images: [hotel3, hotel4],
    descr: 'Отель в историческом центре Санкт-Петербурга.',
    rooms: [
      { type: 'Люкс', price: 6000 },
      { type: 'Эконом', price: 3000 }
    ]
  },
  {
    id: 3,
    name: 'Краснодар',
    images: [hotel5, hotel6],
    descr: 'Современный отель в центре Краснодара.',
    rooms: [
      { type: 'Люкс', price: 4000 },
      { type: 'Эконом', price: 2000 }
    ]
  }
])

const curHI = ref(0)
function nextHotel() {
  if (curHI.value < hotels.value.length - 1)
    curHI.value++
}
function prevHotel() {
  if (curHI.value > 0)
    curHI.value--
}

const selectedHotel = ref(null)
const checkInDate = ref('')
const checkOutDate = ref('')
const today = new Date().toISOString().split('T')[0]
const minCheckInDate = today
const maxCheckOutDate = computed(() => {
  if (!checkInDate.value) return ''
  const date = new Date(checkInDate.value)
  date.setDate(date.getDate() + 30)
  return date.toISOString().split('T')[0]
})

const availableRooms = computed(() => {
  const hotel = hotels.value.find(h => h.id === selectedHotel.value)
  return hotel ? hotel.rooms.map((r, i) => ({
    room_number: i + 1,
    status: r.type,
    price: r.price
  })) : []
})

const selectedRoom = ref(null)
function selectRoom(room) {
  selectedRoom.value = room
  alert(`Вы выбрали ${room.status} №${room.room_number}`)
}

function updateCheckOutLimits() {
  if (checkOutDate.value < checkInDate.value)
    checkOutDate.value = ''
}

async function bookHotel() {
  const token = localStorage.getItem('token')
  if (!token || !selectedHotel.value || !checkInDate.value || !checkOutDate.value || !selectedRoom.value) {
    alert('Заполните все поля для бронирования.')
    return
  }

  try {
    const res = await fetch('http://176.108.251.188:3000/bookHotel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
  hotelId: selectedHotel.value,
  roomType: selectedRoom.value.status,
  checkInDate: checkInDate.value,
  checkOutDate: checkOutDate.value
})
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Ошибка при бронировании')

    alert('Бронирование успешно!')
    closeModal()
  } catch (err) {
    alert('Ошибка: ' + err.message)
  }
}
</script>

<style scoped>
.room-selector {
  display: flex;
  flex-direction: column;
  margin: 15px 0;
  gap: 10px;
}
</style>
