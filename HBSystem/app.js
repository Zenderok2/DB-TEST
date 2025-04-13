const { createApp } = Vue

const app = createApp({
  data()
  {
    return {
      isMod: false,
      curHI: 0,
      isAuth: false,
      bk: { hotel: null, room: null, date: null },
      hotels: [
        {
          id: 1,
          name: 'Москва',
          images: ['media/hotel1.jpg', 'media/hotel2.jpg'],
          descr: 'Отель в центре Москвы с прекрасным видом на Кремль.',
          rooms: [
            { type: 'Люкс', price: 10000 },
            { type: 'Эконом', price: 5000 }
          ]
        },
        {
          id: 2,
          name: 'СПб',
          images: ['media/hotel3.jpg', 'media/hotel4.jpg'],
          descr: 'Отель в историческом центре Санкт-Петербурга.',
          rooms: [
            { type: 'Люкс', price: 12000 },
            { type: 'Эконом', price: 6000 }
          ]
        },
        {
          id: 3,
          name: 'Краснод',
          images: ['media/hotel5.jpg', 'media/hotel6.jpg'],
          descr: 'Отель в центре Краснодара с современным дизайном.',
          rooms: [
            { type: 'Люкс', price: 8000 },
            { type: 'Эконом', price: 4000 }
          ]
        }
      ],
      slideDir: 'slide-left'
    }
  },
  computed:
  {
    curHotelRooms()
    {
      const hid = this.hotels[this.curHI].id
      if (this.bk.hotel === null)
        this.bk.hotel = hid
      if (this.bk.hotel === hid)
        return this.hotels[this.curHI].rooms
      const ht = this.hotels.find(item => item.id === this.bk.hotel)
      return ht ? ht.rooms : []
    }
  },
  methods:
  {
    openModal()
    {
      this.isMod = true
    },
    closeModal()
    {
      this.isMod = false
    },
    goToRegister()
    {
      window.location.href = 'register.html'
    },
    goToLogin()
    {
      window.location.href = 'login.html'
    },
    goToProf()
    {
      window.location.href = 'profile.html'
    },
    prevHotel()
    {
      if (this.curHI > 0)
        this.curHI--
    },
    nextHotel()
    {
      if (this.curHI < this.hotels.length - 1)
        this.curHI++
    },
    checkAuth()
    {
      const tk = localStorage.getItem("token")
      const usr = localStorage.getItem("loggedInUser")
      this.isAuth = !!(tk && usr)
    },
async bookHotel() {
  if (!this.bk.date || !this.bk.room || !this.bk.hotel) {
    return alert("Заполните все поля");
  }
  try {
    const tk = localStorage.getItem("token");
    const response = await fetch("http://176.108.251.188:3000/bookHotel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + tk
      },
      body: JSON.stringify({
        hotelId: this.bk.hotel,
        roomType: this.bk.room,
        checkInDate: this.bk.date
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      alert(data.message || "Бронирование успешно!");
      this.closeModal();
    } else {
      alert(data.message || "Ошибка бронирования");
    }
  } catch (e) {
    console.error("Ошибка:", e);
    alert("Ошибка соединения с сервером");
  }
}
  },
  created()
  {
    this.checkAuth()
  },
  watch:
  {
    curHI(newI, oldI)
    {
      this.slideDir = newI > oldI ? 'slide-left' : 'slide-right'
    }
  }
})

app.mount('body')
