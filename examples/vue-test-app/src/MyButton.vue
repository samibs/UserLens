<template>
  <button @click="handleClick">{{ buttonText }}</button>
</template>

<script>
export default {
  name: 'MyButton',
  props: {
    buttonText: {
      type: String,
      default: 'Click Me'
    }
  },
  methods: {
    handleClick() {
      console.log('Button clicked!');
    }
  }
};
</script>

<style scoped>
button {
  padding: 10px 15px;
  background-color: #4CAF50;
  color: white;
  border: none;
  cursor: pointer;
}
</style>