<template>
<v-sheet
    class="mx-auto"
>
<v-banner shaped><span style="font-size:20pt;">Explore</span></v-banner>
<v-slide-group
      v-model="model"
      active-class="success"
      show-arrows
    >
    <v-slide-item
        v-for="album in albums"
        :key="album.pid"
        class="album"
    >
        <v-card
            class="ma-4"
            height="300"
            width="250"
            @click="openAlbum(album)"
        >
            <div class="text-center text-truncate" style="margin:auto;">{{ album.name }}</div>
            <v-card-actions class="d-flex flex-column align-center">
                <v-img :src="`http://127.0.0.1:3000/image/${album.pid}.jpg`" alt="Album cover" height="200" width="200"/>
                <v-btn @click.stop="playAlbum(album,0)" style="margin-top:15px;">
                    <svg-icon type="mdi" :path="playIconPath"></svg-icon>
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-slide-item>
</v-slide-group>

<div v-if="ifLogin" style="text-align:center;margin-top:50px;">
  <v-divider></v-divider>
  <v-btn
    color="primary"
    elevation="5"
    x-large
    style="margin-top:50px;"
    @click="openUserLibrary()"
  >User Library</v-btn>
</div>

</v-sheet>
</template>

<script>
import axios from 'axios';
import SvgIcon from '@jamescoyle/vue-icon';
import { mdiPlay, mdiPause } from '@mdi/js';

export default {
  name: 'ExploreView',

  computed: {
    ifLogin() {
      return this.$store.state.loginFlag;
    },
  },

  components: {
    SvgIcon,
  },

  data() {
    return {
      playIconPath: mdiPlay,
      pauseIconPath: mdiPause,
      playingFlag: false,
      model: null,
      albums: [],
    };
  },
  // inject: ['setAudioSource'],
  methods: {
    fetchAlbums() {
      axios
        .get('http://127.0.0.1:3000/album')
        .then((response) => {
          this.albums = response.data;
          console.log(this.albums);
        })
        .catch((error) => console.error(error));
    },
    playAlbum(album, order) { // play the track of the corresponding order in the album
      const albumId = album.pid;
      console.log('Start to play album:', albumId, 'with order:', order);
      this.$store.commit('setCurAlbum', album);
      this.$store.commit('setCurOrder', order);
      const url = `http://127.0.0.1:3000/getTrackByOrder/?album_id=${albumId}&order=${order}`;
      axios
        .get(url)
        .then((response) => {
          this.$store.commit('setCurTrack', response.data);
          // this.setAudioSource(`http://127.0.0.1:3000/stream/${this.$store.state.curTrack.track_id}`);
          console.log('Got TrackInfo:', this.$store.state.curTrack);
        })
        .catch((error) => console.error(error));
    },
    openAlbum(album) {
      this.$router.push({ name: 'album', params: { id: album.pid, albumInfo: album } });
    },
    openUserLibrary() {
      this.$router.push({ name: 'library', params: { id: this.$store.state.user.uid } });
    },
  },
  mounted() {
    this.fetchAlbums();
  },
};
</script>

<style scoped>
.album {
}
.text-truncate {
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
