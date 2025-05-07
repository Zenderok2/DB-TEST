<template>
    <div class="hotel-item">
      <h3>{{ hotel.name }}</h3>
      <div class="hotel-images">
        <div
          class="image-container"
          v-for="(img, index) in hotel.images"
          :key="index"
        >
          <img :src="img" :alt="hotel.rooms[index]?.type || 'Фото'" />
          <p class="image-caption">{{ hotel.rooms[index]?.type || 'Тип номера' }}</p>
        </div>
      </div>
      <p>{{ hotel.descr }}</p>
      <h4>Свободные номера:</h4>
      <ul>
        <li v-for="rm in hotel.rooms" :key="rm.type">
          {{ rm.type }} - {{ rm.price }} руб/ночь
        </li>
      </ul>
      <button @click="$emit('book', hotel.id)">Забронировать</button>
    </div>
  </template>
  
  <script setup>
  defineProps({
    hotel: {
      type: Object,
      required: true
    }
  })
  </script>
  
  <style scoped>

  </style>
  