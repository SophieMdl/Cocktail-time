<script>
  import { favorites } from './stores.js';
  import { Link } from 'svelte-routing';
</script>

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
</style>

<div class="header">
  <Link to="/cocktails">
    <h1>Cocktail time !</h1>
  </Link>
  {#if $favorites.length > 0}
    <Link to="/favorites">
      My favorites({$favorites.length})
    </Link>
  {/if}
</div>
