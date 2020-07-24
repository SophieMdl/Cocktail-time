import { writable } from "svelte/store";

export const cocktails = writable([]);
export const searchText = writable("");

const createFavorites = () => {
const { subscribe, update } = writable([]);

    return {
        subscribe,
        add: (cocktail) => update(fav => [...fav, cocktail]),
        remove: (cocktailId) => update((fav) => fav.filter((f) => f.idDrink !== cocktailId)),
    };
}

export const favorites = createFavorites();