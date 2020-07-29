<script>
  import Header from './Header.svelte';
  import CocktailsGrid from './CocktailsGrid.svelte';
  import { favorites } from './stores.js';
</script>

<Header />
<h3>My favorites</h3>
{#if $favorites.length > 0}
  <CocktailsGrid cocktails={$favorites} />
{/if}
