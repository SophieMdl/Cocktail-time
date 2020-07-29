<script>
  import { Router, Link, Route } from 'svelte-routing';
  import CocktailsList from './CocktailsList.svelte';
  import CocktailDetail from './CocktailDetail.svelte';
  import Favorites from './Favorites.svelte';

  export let url = '';
</script>

<div class="app">
  <Router {url}>
    <Route path="cocktails" component={CocktailsList} />
    <Route path="cocktails/:id" let:params>
      <CocktailDetail id={params.id} />
    </Route>
    <Route path="favorites" component={Favorites} />
  </Router>
</div>
