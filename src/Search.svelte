<script>
  import { onMount } from 'svelte';
  import {
    cocktails,
    searchText,
    ingredients,
  } from './stores.js';
  import { navigate, Link } from 'svelte-routing';

  let showFilter = false;

  onMount(async () => {
    if ($ingredients.length > 0) {
      return;
    }
    const res = await fetch(
      'https://www.thecocktaildb.com/api/json/v1/1/list.php?i=list'
    ).then((res) => res.json());
    ingredients.set(res.drinks);
  });

  const submitFilter = async (ingredient) => {
    const res = await fetch(
      `https://www.thecocktaildb.com/api/json/v1/1/filter.php?i=${ingredient}`
    );
    const drinks = await res
      .json()
      .then((res) => res.drinks);
    cocktails.set(drinks);
    navigate('/cocktails');
  };

  const search = async (e) => {
    e.preventDefault();
    const value = e.target.value;
    const res = await fetch(
      `https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${value}`
    );
    const drinks = await res
      .json()
      .then((res) => res.drinks);
    cocktails.set(drinks);
    navigate('/cocktails');
  };

  const toggleShowFilter = () => (showFilter = !showFilter);
</script>

<div>
  <label for="search">Chercher par nom</label>
  <input
    bind:value={$searchText}
    placeholder="Search"
    name="search"
    preventDefault
    on:keydown={(e) => e.key === 'Enter' && search(e)} />
</div>
<div on:click={() => toggleShowFilter()} href="#">
  {#if showFilter}
    Hide ingredient filter
  {:else}Show ingredient filters{/if}
</div>
OR
{#if showFilter}
  <div>
    <label for="choix_bieres">Filter by ingredient :</label>
    <input
      on:change={(e) => submitFilter(e.target.value)}
      list="ingredients"
      type="text"
      id="ingredients-choice" />
    <datalist id="ingredients">
      {#each $ingredients as { strIngredient1 }}
        <option value={strIngredient1} />
      {/each}
    </datalist>
  </div>
{/if}
