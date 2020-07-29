<script>
  import { Link } from 'svelte-routing';
  import Header from './Header.svelte';

  export let cocktails;
</script>

<style>
  .cocktails {
    margin-top: 10px;
    width: 100%;
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    grid-gap: 8px;
  }

  figure,
  img {
    width: 100%;
    margin: 0;
    text-align: center;
  }
  img {
    border-radius: 200px;
  }

  a {
    cursor: pointer;
  }

  @media screen and (max-width: 780px) {
    .cocktails {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>

<div class="cocktails">
  {#if !cocktails}
    <p>Votre recherche n'a pas abouti</p>
  {:else}
    {#each cocktails as cocktail}
      <Link to={`cocktails/${cocktail.idDrink}`}>
        <figure>
          <img
            src={`${cocktail.strDrinkThumb}/preview`}
            alt={cocktail.strDrink} />
          <figcaption>{cocktail.strDrink}</figcaption>
        </figure>
      </Link>
    {/each}
  {/if}
</div>
