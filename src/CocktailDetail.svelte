<script>
  import { Link } from 'svelte-routing';
  import { onMount } from 'svelte';
  import Header from './Header.svelte';
  import { cocktails, favorites } from './stores.js';

  export let id;
  let cocktail;
  let ingredients = [];

  const fetchCocktail = async () => {
    const res = await fetch(
      `https://www.thecocktaildb.com/api/json/v1/1/lookup.php?i=${id}`
    );
    return await res.json().then((res) => res.drinks[0]);
  };

  onMount(async () => {
    cocktail = await fetchCocktail();
    for (const [key, value] of Object.entries(cocktail)) {
      if (key.includes('strIngredient') && value) {
        ingredients = [...ingredients, value];
      }
    }
  });
  console.log($favorites);

  const addToFavorites = () => {
    favorites.update((fav) => [...fav, cocktail]);
  };

  const removeFromFavorites = () => {
    favorites.update((fav) =>
      fav.filter((f) => f.idDrink !== cocktail.idDrink)
    );
  };
</script>

<style>
  .cocktail {
    display: flex;
  }
  .cocktail-img {
    flex-basis: 40%;
    margin-right: 12px;
  }
</style>

<Link to="/cocktails">Retour</Link>
<Header />
{#if cocktail}
  <h1>{cocktail.strDrink}</h1>
  <div class="cocktail">
    <div class="cocktail-img">
      <img
        width="100%"
        src={`${cocktail.strDrinkThumb}`}
        alt={cocktail.strDrink} />
    </div>
    <div>
      <h4>Ingredients</h4>
      {#each ingredients as ingredient}
        <ul>
          <li>{ingredient}</li>
        </ul>
      {/each}
    </div>
  </div>
  {#if $favorites.some((fav) => fav.idDrink === cocktail.idDrink)}
    <button on:click={removeFromFavorites}>
      Retirer des favoris
    </button>
  {:else}
    <button on:click={addToFavorites}>
      Ajouter aux favoris
    </button>
  {/if}
  <h4>Instructions</h4>
  <span>{cocktail.strInstructions}</span>
{:else}
  <p>...waiting</p>
{/if}
