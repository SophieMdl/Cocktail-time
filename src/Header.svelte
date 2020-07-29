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
  .logo {
    display: flex;
}
  .logo img {
    width: 50px;
    margin-right: 8px;
  }
  .red {
  color: #e94444;
  text-decoration: underline;
  }
</style>

<div class="header">
  <Link to="/cocktails">
    <div class="logo">
    <img  src="../images/cocktail.svg" alt="logo" />
    <h2>Cocktail time !</h2>
    </div>
  </Link>
  {#if $favorites.length > 0}
    <Link to="/favorites">
      <span class="red">My favorites({$favorites.length})</span>
    </Link>
  {/if}
</div>
