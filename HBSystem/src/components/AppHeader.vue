<template>
    <header>
      <img :src="logo" alt="Логотип" />
      <h1>Looking-hotel — лучший сайт для бронирования отелей!</h1>
  
      <div id="auth">
        <slot name="right" />
      </div>
  
      <nav>
        <ul>
          <li><RouterLink to="/"><i class="fas fa-home"></i> Главная</RouterLink></li>
          <li><a href="#" @click.prevent="openModal"><i class="fas fa-hotel"></i> Бронь отеля</a></li>
          <li><a href="#" @click.prevent="openModal"><i class="fas fa-map-marked-alt"></i> Бронь экскурсии</a></li>
        </ul>
      </nav>
    </header>
  </template>
  
  <script setup>
  import logo from '@/assets/Looking-hotel.png'
  
  function openModal() {
    alert('Перейдите на главную страницу для бронирования.')
  }
  </script>
  
  <style scoped>
  </style>
  