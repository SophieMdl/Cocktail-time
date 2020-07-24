<script>
  import { cocktails } from './stores.js';
  import { Link } from 'svelte-routing';
  import Header from './Header.svelte';
  import CocktailsGrid from './CocktailsGrid.svelte';
</script>

<Header />
<CocktailsGrid cocktails={$cocktails} />
