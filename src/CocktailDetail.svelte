<script>
  import { Link } from 'svelte-routing';
  import { onMount } from 'svelte';
  import Header from './Header.svelte';
  import { cocktails, favorites } from './stores.js';

  export let id;
  let cocktail;
  let ingredients = [];

  const fetchCocktails = async () => {
    const res = await fetch(
      `https://www.thecocktaildb.com/api/json/v1/1/lookup.php?i=${id}`
    );
    return await res.json().then((res) => res.drinks[0]);
  };

  onMount(async () => {
    cocktail = await fetchCocktails();
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
  }
  .bold {
    font-weight: bold;
  }
</style>

<Header />
{#if cocktail}
  <h1>{cocktail.strDrink}</h1>
  <div class="cocktail">
    <div class="cocktail-img">
      <img
        width="100%"
        src={`${cocktail.strDrinkThumb}/preview`}
        alt={cocktail.strDrink} />
      {#if $favorites.some((fav) => fav.idDrink === cocktail.idDrink)}
        <button on:click={favorites.remove(cocktail.idDrink)}>
          Remove from favorites
        </button>
      {:else}
        <button on:click={favorites.add(cocktail)}>
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
