<script>
  import { cocktails, searchText } from './stores.js';
  import { Link } from 'svelte-routing';
  import Header from './Header.svelte';
  import CocktailsGrid from './CocktailsGrid.svelte';
  import Search from './Search.svelte';
</script>

<Header />
<Search />
{#if $cocktails.length > 0}
  <h3>Results ({$cocktails.length}) :</h3>
<CocktailsGrid cocktails={$cocktails} />
{/if}
