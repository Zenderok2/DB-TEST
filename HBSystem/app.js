const { createApp } = Vue;

const app = createApp({
  data() {
    return {
      isMod: false,
      curHI: 0,
      isAuth: false,
      selectedHotel: null,
      checkInDate: null,
      checkOutDate: null,
      availableRooms: [],
      selectedRoom: null,
      bookingError: null,
      hotels: [
        {
          id: 1,
          name: 'Москва',
          images: ['media/hotel1.jpg', 'media/hotel2.jpg'],
          descr: 'Отель в центре Москвы с прекрасным видом на Кремль.'
        },
        {
          id: 2,
          name: 'СПб',
          images: ['media/hotel3.jpg', 'media/hotel4.jpg'],
          descr: 'Отель в историческом центре Санкт-Петербурга.'
        },
        {
          id: 3,
          name: 'Краснод',
          images: ['media/hotel5.jpg', 'media/hotel6.jpg'],
          descr: 'Отель в центре Краснодара с современным дизайном.'
        }
      ],
      slideDir: 'slide-left'
    }
  },
  computed: {
    minCheckInDate() {
      return new Date().toISOString().split('T')[0];
    },
    maxCheckInDate() {
      const date = new Date();
      date.setMonth(date.getMonth() + 1, 15); // +1.5 месяца
      return date.toISOString().split('T')[0];
    },
    minCheckOutDate() {
      return this.checkInDate ? 
        new Date(this.checkInDate).toISOString().split('T')[0] : 
        this.minCheckInDate;
    },
    maxCheckOutDate() {
      if (!this.checkInDate) return null;
      const date = new Date(this.checkInDate);
      date.setDate(date.getDate() + 14);
      return date.toISOString().split('T')[0];
    }
  },
  methods: {
    async loadAvailableRooms() {
      if (!this.selectedHotel || !this.checkInDate || !this.checkOutDate) return;
      
      try {
        const response = await fetch('http://176.108.251.188:3000/check-rooms', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem("token")
          },
          body: JSON.stringify({
            hotelId: this.selectedHotel,
            checkIn: this.checkInDate,
            checkOut: this.checkOutDate
          })
        });

        if (!response.ok) throw new Error(await response.text());
        
        this.availableRooms = await response.json();
        this.bookingError = null;

      } catch (error) {
        this.bookingError = error.message;
      }
    },

    async bookHotel() {
      if (!this.selectedRoom || !this.checkInDate || !this.checkOutDate) {
        this.bookingError = "Заполните все поля";
        return;
      }

      try {
        const response = await fetch("http://176.108.251.188:3000/bookHotel", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
          },
          body: JSON.stringify({
            hotelId: this.selectedHotel,
            roomNumber: this.selectedRoom.room_number,
            checkInDate: this.checkInDate,
            checkOutDate: this.checkOutDate
          })
        });

        const data = await response.json();
        
        if (!response.ok) throw new Error(data.message || "Ошибка бронирования");

        alert("Бронирование успешно!");
        this.closeModal();
        window.location.reload();

      } catch (error) {
        this.bookingError = error.message;
      }
    },

    validateDates() {
      const checkIn = new Date(this.checkInDate);
      const checkOut = new Date(this.checkOutDate);
      const maxDate = new Date(this.maxCheckInDate);

      if (checkIn > maxDate) {
        this.bookingError = "Максимальная дата бронирования - 1.5 месяца вперед";
        return false;
      }

      if ((checkOut - checkIn) / (1000 * 3600 * 24) > 14) {
        this.bookingError = "Максимальная длительность бронирования - 14 дней";
        return false;
      }

      return true;
    },

    openModal() {
      this.isMod = true;
      this.selectedHotel = this.hotels[this.curHI].id;
    },

    closeModal() {
      this.isMod = false;
      this.selectedHotel = null;
      this.checkInDate = null;
      this.checkOutDate = null;
      this.selectedRoom = null;
      this.bookingError = null;
    },

    checkAuth() {
      const tk = localStorage.getItem("token");
      const usr = localStorage.getItem("loggedInUser");
      this.isAuth = !!(tk && usr);
      
      if (this.isAuth) {
        fetch('http://176.108.251.188:3000/active-booking', {
          headers: { 'Authorization': 'Bearer ' + tk }
        })
          .then(res => res.json())
          .then(data => {
            if (data.active) this.isMod = false;
          });
      }
    },

    // Остальные методы без изменений
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
  },
  watch: {
    checkInDate() {
      if (this.validateDates()) {
        this.loadAvailableRooms();
      }
    },
    checkOutDate() {
      this.validateDates();
    },
    curHI(newI, oldI) {
      this.slideDir = newI > oldI ? 'slide-left' : 'slide-right';
    }
  },
  created() {
    this.checkAuth();
  }
});

app.mount('body');
