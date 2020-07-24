<script>
    import Header from './Header.svelte';
    import CocktailsGrid from './CocktailsGrid.svelte'
    import {favorites} from './stores.js'
    console.log($favorites)
</script>

<Header />
{#if $favorites.length > 0}
    <CocktailsGrid cocktails={$favorites} />
{/if}