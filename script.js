let locations = JSON.parse(localStorage.getItem("locations")) || [];
let categories = JSON.parse(localStorage.getItem("categories")) || [];
let map;
let markers = [];
let service;

// Google Maps 初期化
function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 12,
        center: { lat: 35.6895, lng: 139.6917 }
    });

    service = new google.maps.places.PlacesService(map);
    displayMarkers();
    document.getElementById("categoryFilter").addEventListener("change", displayMarkers);
    updateFavoriteList();
    setupSearch();
    updateCategoryDropdown();
}

// マーカーを表示
function displayMarkers() {
    markers.forEach(marker => marker.setMap(null));
    markers = [];

    const selectedCategory = document.getElementById("categoryFilter").value;

    locations.forEach((location, index) => {
        if (selectedCategory === "all" || location.category === selectedCategory) {
            const marker = new google.maps.Marker({
                position: { lat: location.lat, lng: location.lng },
                map: map,
                title: location.name
            });

            const infoWindow = new google.maps.InfoWindow({
                content: `<h3>${location.name}</h3><p>カテゴリ: ${location.category}</p>
                          <button onclick="removeRestaurant(${index})">削除</button>
                          <button onclick="editRestaurant(${index})">編集</button>`
            });

            marker.addListener("click", () => {
                infoWindow.open(map, marker);
            });

            markers.push(marker);
        }
    });
}

// 飲食店の検索機能をセットアップ
function setupSearch() {
    const searchInput = document.getElementById("restaurantSearch");
    searchInput.addEventListener("input", function() {
        const query = searchInput.value;
        if (query.length < 2) return;

        const request = {
            query: query + " 飲食店",  // 検索対象を広げる
            location: map.getCenter(), // 現在の地図の中心を基準に検索
            radius: 5000, // 半径5km以内
        };

        service.textSearch(request, function(results, status) {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
                showSearchResults(results);
            }
        });
    });
}


// 検索結果を表示（最大3つまで）
function showSearchResults(results) {
    const searchResults = document.getElementById("searchResults");
    searchResults.innerHTML = "";

    // 最大3つの候補のみ表示
    results.slice(0, 3).forEach((place) => {
        const li = document.createElement("li");
        li.textContent = place.name;
        li.onclick = () => addRestaurant(place);
        searchResults.appendChild(li);
    });
}

// 新しい飲食店を追加 & 重複チェック
function addRestaurant(place) {
    let category = prompt("カテゴリを入力してください");
    if (!category) return;

    const newRestaurant = {
        name: place.name,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        category: category
    };

    // **既存のリストと比較（大文字・小文字を区別しない）**
    const isDuplicate = locations.some(
        (store) => store.name.toLowerCase() === newRestaurant.name.toLowerCase()
    );

    if (isDuplicate) {
        alert(`「${newRestaurant.name}」はすでにお気に入りリストにあります！`);
        return; // 追加せずに終了
    }

    locations.push(newRestaurant);
    localStorage.setItem("locations", JSON.stringify(locations));

    // 新しいカテゴリーが追加された場合、カテゴリリストにも追加
    if (!categories.includes(category)) {
        categories.push(category);
        localStorage.setItem("categories", JSON.stringify(categories));
        updateCategoryDropdown();
    }

    displayMarkers();
    updateFavoriteList();
}


// カテゴリのドロップダウンを更新
function updateCategoryDropdown() {
    const categoryFilter = document.getElementById("categoryFilter");
    categoryFilter.innerHTML = '<option value="all">すべて</option>';

    categories.forEach(category => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
}


// お気に入りリストを更新
function updateFavoriteList() {
    const list = document.getElementById("favoriteList");
    list.innerHTML = "";

    locations.forEach((store, index) => {
        const li = document.createElement("li");
        li.innerHTML = `${store.name} (${store.category}) 
                        <button onclick="removeRestaurant(${index})">削除</button>
                        <button onclick="editRestaurant(${index})">編集</button>`;
        list.appendChild(li);
    });
}

// 飲食店を削除
function removeRestaurant(index) {
    locations.splice(index, 1);
    localStorage.setItem("locations", JSON.stringify(locations));

    displayMarkers();
    updateFavoriteList();
}

// 飲食店を編集
function editRestaurant(index) {
    const newName = prompt("新しい店名:", locations[index].name);
    const newCategory = prompt("新しいカテゴリ:", locations[index].category);

    if (newName && newCategory) {
        locations[index] = { name: newName, category: newCategory };
        localStorage.setItem("locations", JSON.stringify(locations));

        // 新しいカテゴリが追加された場合、リストに追加
        if (!categories.includes(newCategory)) {
            categories.push(newCategory);
            localStorage.setItem("categories", JSON.stringify(categories));
            updateCategoryDropdown();
        }

        displayMarkers();
        updateFavoriteList();
    }
}
// 現在地を取得してマップを移動
function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            // マップを現在地に移動
            map.setCenter(userLocation);

            // 現在地マーカーを追加
            new google.maps.Marker({
                position: userLocation,
                map: map,
                title: "現在地",
                icon: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
            });

        }, () => {
            alert("位置情報を取得できませんでした。");
        });
    } else {
        alert("このブラウザは位置情報をサポートしていません。");
    }
}
// 場所を検索してマップを移動（都市・駅・建物・エリア名対応）
function searchPlace() {
    const placeName = document.getElementById("placeSearch").value;
    if (!placeName) {
        alert("検索する場所を入力してください！");
        return;
    }

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: placeName }, function(results, status) {
        if (status === "OK") {
            const placeLocation = results[0].geometry.location;
            map.setCenter(placeLocation);
            map.setZoom(15); // ズームレベルを適切に設定

            // 検索した場所にマーカーを追加
            new google.maps.Marker({
                position: placeLocation,
                map: map,
                title: placeName,
                icon: "http://maps.google.com/mapfiles/ms/icons/purple-dot.png"
            });

        } else {
            alert("場所が見つかりませんでした: " + status);
        }
    });
}

document.getElementById("toggleFavorites").addEventListener("click", function() {
    const favoriteContainer = document.getElementById("favoriteContainer");

    if (favoriteContainer.style.display === "none") {
        favoriteContainer.style.display = "block";
        this.classList.add("open"); // ボタンを回転
        this.textContent = "×"; // ボタンを「×」に変更
    } else {
        favoriteContainer.style.display = "none";
        this.classList.remove("open"); // 回転を戻す
        this.textContent = "＋"; // ボタンを「＋」に戻す
    }
});

