export const CATEGORIES = [
  { id: "burgers", name: "Бургеры", icon: "🍔", active: true },
  { id: "pizza", name: "Пицца", icon: "🍕", active: false },
  { id: "drinks", name: "Напитки", icon: "🥤", active: false },
  { id: "snacks", name: "Снэки", icon: "🍟", active: false },
];

export const PRODUCTS = [
  {
    id: 1,
    name: "Двойной Смэш Бургер",
    desc: "Две сочные говяжьи котлеты, сыр чеддер, свежий салат, фирменный соус на мягкой булочке.",
    basePrice: 550,
    img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80",
    category: "burgers",
    calories: 450,
    time: 20,
    rating: 4.8,
    sizes: [
      { id: "s1", name: "Обычный", price: 0 },
      { id: "s2", name: "Большой", price: 150 },
      { id: "s3", name: "Монстр", price: 280 },
    ],
    toppings: [
      { id: "t1", name: "Сыр", icon: "🧀", price: 60 },
      { id: "t2", name: "Бекон", icon: "🥓", price: 90 },
      { id: "t3", name: "Халапеньо", icon: "🌶️", price: 50 },
      { id: "t4", name: "Яйцо", icon: "🍳", price: 70 },
    ],
  },
  {
    id: 2,
    name: "Пицца Пепперони",
    desc: "Классическая итальянская пицца с острой колбаской пепперони, моцареллой и томатным соусом.",
    basePrice: 650,
    img: "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=500&q=80",
    category: "pizza",
    calories: 680,
    time: 30,
    rating: 4.9,
    sizes: [
      { id: "s1", name: "25 см", price: 0 },
      { id: "s2", name: "30 см", price: 200 },
      { id: "s3", name: "35 см", price: 400 },
    ],
    toppings: [
      { id: "t1", name: "Экстра сыр", icon: "🧀", price: 100 },
      { id: "t2", name: "Грибы", icon: "🍄", price: 80 },
      { id: "t3", name: "Оливки", icon: "🫒", price: 60 },
      { id: "t4", name: "Острый соус", icon: "🔥", price: 40 },
    ],
  },
  {
    id: 3,
    name: "Чикен Бургер",
    desc: "Хрустящая куриная котлета, айсберг, маринованные огурчики и соус ранч.",
    basePrice: 420,
    img: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=500&q=80",
    category: "burgers",
    calories: 380,
    time: 15,
    rating: 4.6,
    sizes: [
      { id: "s1", name: "Обычный", price: 0 },
      { id: "s2", name: "Большой", price: 120 },
      { id: "s3", name: "Монстр", price: 250 },
    ],
    toppings: [
      { id: "t1", name: "Сыр", icon: "🧀", price: 60 },
      { id: "t2", name: "Бекон", icon: "🥓", price: 90 },
      { id: "t3", name: "Халапеньо", icon: "🌶️", price: 50 },
      { id: "t4", name: "Яйцо", icon: "🍳", price: 70 },
    ],
  },
  {
    id: 4,
    name: "Маргарита",
    desc: "Классическая пицца с томатным соусом, моцареллой и базиликом.",
    basePrice: 490,
    img: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=80",
    category: "pizza",
    calories: 550,
    time: 25,
    rating: 4.7,
    sizes: [
      { id: "s1", name: "25 см", price: 0 },
      { id: "s2", name: "30 см", price: 180 },
      { id: "s3", name: "35 см", price: 350 },
    ],
    toppings: [
      { id: "t1", name: "Экстра сыр", icon: "🧀", price: 100 },
      { id: "t2", name: "Грибы", icon: "🍄", price: 80 },
      { id: "t3", name: "Оливки", icon: "🫒", price: 60 },
      { id: "t4", name: "Базилик", icon: "🌿", price: 30 },
    ],
  },
];

export const formatPrice = (value) => `${value} ₽`;
