import { useEffect, useState, useCallback } from "react";
import { PRODUCTS, CATEGORIES, formatPrice } from "./data.js";

const tg = window.Telegram?.WebApp;

export default function App() {
  // ======= STATE =======
  const [cart, setCart] = useState([]);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedToppings, setSelectedToppings] = useState(new Set());
  const [activeCategory, setActiveCategory] = useState("burgers");
  const [favorites, setFavorites] = useState(new Set());

  const [editingCartItemId, setEditingCartItemId] = useState(null);

  // Screens: "home" | "details" | "cart"
  const [showDetails, setShowDetails] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    tg?.ready();
    tg?.expand();
  }, []);

  // ======= PRODUCT DETAILS =======
  const openDetails = useCallback((productId) => {
    const product = PRODUCTS.find((p) => p.id === productId);
    setCurrentProduct(product);
    setSelectedSize(product.sizes[0]);
    setSelectedToppings(new Set());
    setEditingCartItemId(null);
    setShowDetails(true);
  }, []);

  const editCartItem = useCallback((cartItem) => {
    const product = PRODUCTS.find((p) => p.id === cartItem.productId);
    if (!product) return;
    setCurrentProduct(product);
    const sizeObj = product.sizes.find((s) => s.id === cartItem.sizeId) || product.sizes[0];
    setSelectedSize(sizeObj);
    setSelectedToppings(new Set(cartItem.toppingIds || []));
    setEditingCartItemId(cartItem.id);
    setShowCart(false);
    setShowDetails(true);
  }, []);

  const closeDetails = useCallback(() => {
    setShowDetails(false);
    if (editingCartItemId) {
      setShowCart(true);
      setEditingCartItemId(null);
    }
  }, [editingCartItemId]);

  const selectSize = useCallback((sizeId) => {
    if (!currentProduct) return;
    setSelectedSize(currentProduct.sizes.find((s) => s.id === sizeId));
  }, [currentProduct]);

  const toggleTopping = useCallback((toppingId) => {
    setSelectedToppings((prev) => {
      const next = new Set(prev);
      if (next.has(toppingId)) {
        next.delete(toppingId);
      } else {
        next.add(toppingId);
      }
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((productId) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
    tg?.HapticFeedback?.impactOccurred("light");
  }, []);

  const getDetailPrice = () => {
    if (!currentProduct || !selectedSize) return 0;
    let total = currentProduct.basePrice + selectedSize.price;
    selectedToppings.forEach((id) => {
      const t = currentProduct.toppings.find((x) => x.id === id);
      if (t) total += t.price;
    });
    return total;
  };

  // ======= CART =======
  const addToCart = useCallback(() => {
    if (!currentProduct || !selectedSize) return;
    let itemPrice = currentProduct.basePrice + selectedSize.price;
    const toppingIds = Array.from(selectedToppings);
    toppingIds.forEach((id) => {
      const t = currentProduct.toppings.find((x) => x.id === id);
      if (t) {
        itemPrice += t.price;
      }
    });

    if (editingCartItemId) {
      setCart((prev) =>
        prev.map((item) => {
          if (item.id === editingCartItemId) {
            return {
              ...item,
              size: selectedSize.name,
              sizeId: selectedSize.id,
              toppingIds,
              price: itemPrice,
            };
          }
          return item;
        })
      );
      tg?.HapticFeedback?.impactOccurred("medium");
      setShowDetails(false);
      setShowCart(true);
      setEditingCartItemId(null);
      return;
    }

    const cartItem = {
      id: Date.now(),
      productId: currentProduct.id,
      name: currentProduct.name,
      img: currentProduct.img,
      size: selectedSize.name,
      sizeId: selectedSize.id,
      toppingIds,
      price: itemPrice,
      qty: 1,
    };

    setCart((prev) => [...prev, cartItem]);
    tg?.HapticFeedback?.impactOccurred("light");
    closeDetails();
  }, [currentProduct, selectedSize, selectedToppings, editingCartItemId, closeDetails]);

  const removeToppingFromCartItem = useCallback((cartItemId, toppingId) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== cartItemId) return item;
        const product = PRODUCTS.find((p) => p.id === item.productId);
        const toppingObj = product?.toppings.find((t) => t.id === toppingId);
        const toppingPrice = toppingObj?.price || 0;
        const nextToppings = (item.toppingIds || []).filter((id) => id !== toppingId);
        return {
          ...item,
          toppingIds: nextToppings,
          price: Math.max(0, item.price - toppingPrice),
        };
      })
    );
    tg?.HapticFeedback?.impactOccurred("light");
  }, []);

  const removeFromCart = useCallback((itemId) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  const openCart = useCallback(() => setShowCart(true), []);
  const closeCart = useCallback(() => setShowCart(false), []);

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const checkout = useCallback(() => {
    setCheckoutLoading(true);
    setTimeout(() => {
      alert("Заказ успешно оформлен! 🎉");
      setCart([]);
      setCheckoutLoading(false);
      setShowCart(false);
    }, 1000);
  }, []);

  const filteredProducts = PRODUCTS.filter(
    (p) => p.category === activeCategory
  );

  // ======= RENDER =======
  return (
    <div
      id="app"
      className="max-w-md w-full mx-auto relative bg-[#F8F9FA] h-[100dvh] overflow-hidden shadow-2xl flex flex-col font-sans rounded-none md:rounded-[2.5rem] md:h-[90vh] md:border-[8px] border-gray-800"
    >
      {/* ==================== SCREEN 1: HOME ==================== */}
      <div
        id="home-screen"
        className={`screen ${showDetails || showCart ? "" : "screen-active"} absolute inset-0 z-10 overflow-y-auto pb-28 no-scrollbar`}
      >
        {/* Header */}
        <header className="px-6 pt-6">
          <div className="flex items-center gap-3">
            {/* Dark rounded icon box */}
            <div className="w-12 h-12 bg-gray-950 rounded-2xl flex items-center justify-center shadow-md shadow-black/10 shrink-0">
              <span className="text-2xl leading-none select-none">🍔</span>
            </div>
            {/* Brand text */}
            <div className="flex flex-col">
              <span className="text-xl font-black text-gray-900 tracking-wider leading-none">
                YUMMY
              </span>
              <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mt-1">
                доставка еды
              </span>
            </div>
          </div>
        </header>

        {/* Greeting */}
        <div className="px-6 pt-5 pb-5">
          <h1 className="text-3xl font-extrabold text-gray-900 leading-tight">
            Что будем <br />
            <span className="text-brand">есть сегодня?</span> 🤤
          </h1>
        </div>

        {/* Categories */}
        <div className="flex overflow-x-auto gap-4 px-6 mb-8 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex flex-col items-center justify-center min-w-[70px] h-[90px] rounded-[24px] active:scale-95 transition transform ${
                activeCategory === cat.id
                  ? "bg-brand text-white shadow-brand"
                  : "bg-white text-gray-600 shadow-soft"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 text-xl ${
                  activeCategory === cat.id ? "bg-white/20" : "bg-gray-50"
                }`}
              >
                {cat.icon}
              </div>
              <span className="text-xs font-semibold">{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Products */}
        <div className="px-6 mb-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Популярное</h2>
          <div className="grid grid-cols-2 gap-4">
            {filteredProducts.map((product, index) => {
              const catLabel = CATEGORIES.find(c => c.id === product.category)?.name || "";
              const isFav = favorites.has(product.id);
              return (
                <div
                  key={product.id}
                  onClick={() => openDetails(product.id)}
                  className={`bg-white rounded-[20px] overflow-hidden shadow-soft cursor-pointer active:scale-[0.97] transition transform opacity-0 animate-pop-in delay-${(index + 1) * 100}`}
                >
                  {/* Image */}
                  <div className="relative w-full h-36 bg-gray-50">
                    <img
                      src={product.img}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                    {/* Heart */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(product.id);
                      }}
                      className="absolute top-2.5 right-2.5 w-8 h-8 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md active:scale-90 transition"
                      aria-label="В избранное"
                    >
                      {isFav ? (
                        <i className="fa-solid fa-heart text-red-500 text-sm"></i>
                      ) : (
                        <i className="fa-regular fa-heart text-gray-700 text-sm"></i>
                      )}
                    </button>
                  </div>

                  {/* Info */}
                  <div className="p-3.5">
                    <h3 className="font-bold text-gray-900 text-sm leading-tight mb-1">
                      {product.name}
                    </h3>
                    <p className="text-[11px] text-gray-400 mb-3">
                      {catLabel} · {product.time}-{product.time + 10} мин
                    </p>
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="font-extrabold text-gray-900 text-base">
                          {product.basePrice} ₽
                        </span>
                        <p className="text-[10px] text-gray-400 mt-0.5">от цены</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetails(product.id);
                        }}
                        className="w-10 h-10 bg-brand text-white rounded-2xl flex items-center justify-center shadow-brand active:scale-90 transition"
                        aria-label="Открыть товар"
                      >
                        <i className="fa-solid fa-plus text-base"></i>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ==================== SCREEN 2: PRODUCT DETAILS ==================== */}
      <div
        id="details-screen"
        className={`screen ${showDetails ? "screen-active" : "screen-hidden-right"} absolute inset-0 z-30 bg-white flex flex-col`}
      >
        {/* Details Header */}
        <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-40">
          <button
            onClick={closeDetails}
            className="w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow-sm active:scale-90 transition"
          >
            <i className="fa-solid fa-arrow-left text-gray-800"></i>
          </button>
          <button
            type="button"
            onClick={() => currentProduct && toggleFavorite(currentProduct.id)}
            className="w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow-sm active:scale-90 transition"
            aria-label="В избранное"
          >
            <i
              className={`fa-solid fa-heart transition-colors duration-200 ${
                currentProduct && favorites.has(currentProduct.id)
                  ? "text-red-500"
                  : "text-gray-300 hover:text-red-400"
              }`}
            ></i>
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
          {/* Image */}
          <div className="relative w-full h-[45%] bg-brand-light flex items-center justify-center rounded-b-[40px] pt-10">
            {currentProduct && (
              <img
                src={currentProduct.img}
                alt={currentProduct.name}
                className="w-64 h-64 object-contain animate-float drop-shadow-2xl mix-blend-multiply"
              />
            )}
          </div>

          <div className="px-6 pt-6">
            <div className="flex justify-between items-start mb-2">
              <h1 className="text-2xl font-bold text-gray-900 leading-tight w-2/3">
                {currentProduct?.name}
              </h1>
              <div className="flex items-center bg-brand text-white px-2 py-1 rounded-lg text-sm font-bold shadow-sm">
                <i className="fa-solid fa-star text-[10px] mr-1"></i>
                {currentProduct?.rating}
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              {currentProduct?.desc}
            </p>

            {/* Size selection */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-gray-900">Размер</h3>
              </div>
              <div className="flex gap-3">
                {currentProduct?.sizes.map((size) => {
                  const isActive = selectedSize?.id === size.id;
                  return (
                    <button
                      key={size.id}
                      onClick={() => selectSize(size.id)}
                      className={`flex-1 py-3 border-2 rounded-2xl font-semibold text-sm transition active:scale-95 ${
                        isActive
                          ? "bg-brand text-white border-brand shadow-brand"
                          : "bg-white text-gray-600 border-gray-200"
                      }`}
                    >
                      {size.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toppings */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-900 mb-3">
                Добавить топпинги
              </h3>
              <div className="flex flex-wrap gap-3">
                {currentProduct?.toppings.map((top) => {
                  const isActive = selectedToppings.has(top.id);
                  return (
                    <div
                      key={top.id}
                      onClick={() => toggleTopping(top.id)}
                      className={`relative border-2 rounded-xl p-3 flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition w-[calc(33.333%-0.5rem)] ${
                        isActive
                          ? "border-brand bg-brand-light text-brand"
                          : "border-gray-200 bg-white text-gray-700"
                      }`}
                    >
                      {isActive && (
                        <i className="fa-solid fa-circle-check absolute top-1.5 right-1.5 text-brand"></i>
                      )}
                      <span className="text-2xl">{top.icon}</span>
                      <span className="text-xs font-semibold mt-1">
                        {top.name}
                      </span>
                      <span className="text-[10px] opacity-80">
                        +{top.price}₽
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Details Footer (Fixed) */}
        <div className="absolute bottom-0 left-0 w-full bg-white p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] rounded-t-[30px] z-40 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 mb-1">Итоговая цена</span>
            <span className="text-2xl font-black text-gray-900">
              {formatPrice(getDetailPrice())}
            </span>
          </div>
          <button
            onClick={addToCart}
            className="bg-gray-900 text-white px-8 py-4 rounded-[20px] font-semibold flex items-center gap-2 active:scale-95 transition shadow-lg"
          >
            <span>{editingCartItemId ? "Сохранить" : "В корзину"}</span>
            <i className={`fa-solid ${editingCartItemId ? "fa-check" : "fa-bag-shopping"} text-sm`}></i>
          </button>
        </div>
      </div>

      {/* ==================== SCREEN 3: CART ==================== */}
      <div
        id="cart-screen"
        className={`screen ${showCart ? "screen-active" : "screen-hidden-bottom"} absolute inset-0 z-50 bg-[#F8F9FA] flex flex-col`}
      >
        <div className="p-6 bg-white flex justify-between items-center shadow-sm z-10">
          <h2 className="text-xl font-bold text-gray-900">Корзина</h2>
          <button
            onClick={closeCart}
            className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center active:scale-90 transition"
          >
            <i className="fa-solid fa-xmark text-gray-800"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
              <i className="fa-solid fa-basket-shopping text-6xl mb-4 text-gray-300"></i>
              <p className="text-gray-500">Ваша корзина пуста</p>
            </div>
          ) : (
            cart.map((item, index) => {
              const product = PRODUCTS.find((p) => p.id === item.productId);
              const toppingItems = (item.toppingIds || [])
                .map((tid) => product?.toppings?.find((t) => t.id === tid))
                .filter(Boolean);

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl p-3.5 shadow-sm mb-4 opacity-0 animate-pop-in delay-${(index + 1) * 100} relative`}
                >
                  <div className="flex gap-3">
                    <div className="w-20 h-20 bg-gray-50 rounded-xl flex items-center justify-center p-1 shrink-0 overflow-hidden">
                      <img
                        src={item.img}
                        alt={item.name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                    <div className="flex-1 pr-6">
                      <h4 className="font-bold text-gray-900 text-sm leading-tight">
                        {item.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Размер: {item.size}
                      </p>

                      <div className="font-black text-brand text-base mt-1.5">
                        {formatPrice(item.price)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      className="absolute top-3.5 right-3.5 text-gray-300 hover:text-red-500 transition active:scale-90"
                      aria-label="Удалить"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>

                  {/* Toppings section */}
                  {toppingItems.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500">
                          Добавки ({toppingItems.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => editCartItem(item)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:text-brand-dark active:scale-95 transition"
                        >
                          <i className="fa-solid fa-sliders text-xs"></i>
                          <span>Настроить</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {toppingItems.map((top) => (
                          <div
                            key={top.id}
                            className="inline-flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200/80 rounded-xl px-2.5 py-1.5 text-xs font-medium text-gray-800 transition"
                          >
                            <span className="text-sm">{top.icon}</span>
                            <span>{top.name}</span>
                            <button
                              type="button"
                              onClick={() => removeToppingFromCartItem(item.id, top.id)}
                              className="w-4 h-4 rounded-full bg-gray-200 hover:bg-red-500 hover:text-white text-gray-500 flex items-center justify-center ml-0.5 transition active:scale-90"
                              title={`Убрать ${top.name}`}
                              aria-label={`Убрать топинг ${top.name}`}
                            >
                              <i className="fa-solid fa-xmark text-[9px]"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {toppingItems.length === 0 && (
                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs text-gray-400">Без добавок</span>
                      <button
                        type="button"
                        onClick={() => editCartItem(item)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:text-brand-dark active:scale-95 transition"
                      >
                        <i className="fa-solid fa-plus text-xs"></i>
                        <span>Добавить топинги</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Cart Footer */}
        {cart.length > 0 && (
          <div className="bg-white p-6 rounded-t-[30px] shadow-[0_-10px_40px_rgba(0,0,0,0.08)]">
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Сумма заказов</span>
                <span className="font-medium text-gray-900">
                  {formatPrice(cartTotal)}
                </span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Доставка</span>
                <span className="font-medium text-green-500">Бесплатно</span>
              </div>
              <div className="h-px w-full bg-gray-100 my-2"></div>
              <div className="flex justify-between items-end">
                <span className="text-gray-900 font-bold">К оплате</span>
                <span className="text-2xl font-black text-brand">
                  {formatPrice(cartTotal)}
                </span>
              </div>
            </div>
            <button
              onClick={checkout}
              className="w-full bg-brand text-white py-4 rounded-[20px] font-bold text-lg active:scale-95 transition shadow-brand"
            >
              {checkoutLoading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                  Оформляем...
                </>
              ) : (
                "Оформить заказ"
              )}
            </button>
          </div>
        )}
      </div>

      {/* ==================== BOTTOM NAVIGATION ==================== */}
      <div
        id="bottom-nav"
        className={`absolute bottom-6 left-6 right-6 h-[70px] bg-gray-900 rounded-[24px] shadow-2xl flex justify-between items-center px-8 z-20 transition-transform duration-300 ${
          showDetails || showCart ? "translate-y-[150%]" : "translate-y-0"
        }`}
      >
        <button className="text-white flex flex-col items-center gap-1 active:scale-90 transition">
          <i className="fa-solid fa-house text-lg"></i>
          <div className="w-1 h-1 bg-brand rounded-full"></div>
        </button>
        <button className="text-gray-400 hover:text-white flex flex-col items-center gap-1 active:scale-90 transition">
          <i className="fa-regular fa-heart text-lg"></i>
        </button>

        {/* Cart Button */}
        <button
          onClick={openCart}
          className="relative -top-5 w-14 h-14 bg-brand rounded-full flex items-center justify-center shadow-brand active:scale-90 transition border-[6px] border-[#F8F9FA]"
        >
          <i className="fa-solid fa-bag-shopping text-white"></i>
          {cart.length > 0 && (
            <span className="absolute top-0 -right-1 bg-white text-brand text-[10px] font-extrabold w-5 h-5 flex items-center justify-center rounded-full shadow-md animate-badge">
              {cart.length}
            </span>
          )}
        </button>

        <button className="text-gray-400 hover:text-white flex flex-col items-center gap-1 active:scale-90 transition">
          <i className="fa-regular fa-bell text-lg"></i>
        </button>
        <button className="text-gray-400 hover:text-white flex flex-col items-center gap-1 active:scale-90 transition">
          <i className="fa-regular fa-user text-lg"></i>
        </button>
      </div>
    </div>
  );
}
