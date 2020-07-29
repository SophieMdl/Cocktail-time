<script>
  import { Link } from 'svelte-routing';
  import { onMount, beforeUpdate } from 'svelte';
  import Header from './Header.svelte';
  import { cocktails, favorites } from './stores.js';
  import StarFilled32 from "carbon-icons-svelte/lib/StarFilled32";

  export let id;
  let cocktail;
  let ingredients = [];

  const fetchCocktail = async () => {
    const res = await fetch(
      `https://www.thecocktaildb.com/api/json/v1/1/lookup.php?i=${id}`
    );
    return await res.json().then((res) => res.drinks[0]);
  };
  
  let isFavorite = $favorites.some(fav => fav.idDrink === id)

beforeUpdate(() => {
	isFavorite = $favorites.some(fav => fav.idDrink === id)
});

  onMount(async () => {
    cocktail = isFavorite ? $favorites.find(fav => fav.idDrink === id) : await fetchCocktail();
    for (const [key, value] of Object.entries(cocktail)) {
      if (key.includes('strIngredient') && value) {
        ingredients = [...ingredients, value];
      }
    }
    ingredients = ingredients.map(
      (ingredient, i) =>
        `${ingredient} : ${cocktail[`strMeasure${i + 1}`]}`
    );
  });
</script>

<style>
  .cocktail {
    display: flex;
  }
  .cocktail-img {
    flex-basis: 40%;
    max-width: 200px;
    margin-right: 12px;
    position: relative;
  }
  .bold {
    font-weight: bold;
  }

  .button {
    border: none;
    background: #e94444;
    color: white;
    width: 100%;
    padding: 10px 0px;
  }
  .icon {
    color: #e94444;
    position: absolute;
    left: 5px;
    top: 5px;
  }
</style>

<Header />
{#if cocktail}
  <h3>{cocktail.strDrink}</h3>
  <div class="cocktail">
    <div class="cocktail-img">
      {#if isFavorite}
        <StarFilled32 class="icon favorite"/>
      {/if}
      <img
        width="100%"
        src={`${cocktail.strDrinkThumb}/preview`}
        alt={cocktail.strDrink} />
      {#if isFavorite}
        <button class="button" on:click={favorites.remove(cocktail.idDrink)}>
          Remove favorite
        </button>
      {:else}
        <button class="button" on:click={favorites.add(cocktail)}>
          Add to favorites
        </button>
      {/if}
    </div>
    <div>
      <span class="bold">Ingredients</span>
      <ul>
        {#each ingredients as ingredient}
          <li>{ingredient}</li>
        {/each}
      </ul>
    </div>
  </div>
  <h4>Instructions</h4>
  <span>{cocktail.strInstructions}</span>
{:else}
  <p>...waiting</p>
{/if}
