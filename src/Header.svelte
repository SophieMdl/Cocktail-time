
<script>
import { cocktails, searchText } from './stores.js'
import { navigate, Link } from "svelte-routing";

const search = async(e) => {
	e.preventDefault();
	const value = e.target.value;
	const res = await fetch(`https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${value}`)
	const drinks = await res.json().then(res => res.drinks)
	cocktails.set(drinks);
	navigate("/cocktails")
}
</script>

<Link to="/index"><h1>Cocktail time !</h1></Link>
<div>
	<label for="search">Chercher un cocktail</label>
	<input bind:value={$searchText} placeholder="Search" name="search" preventDefault on:keydown={e => e.key === 'Enter' && search(e)} />
</div>