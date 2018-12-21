import '../styles/style.scss';

import * as React from 'react';
import * as DOM from 'react-dom';
import { fetchVideos, downloader, download } from '../services/api';
import { IVideoEntity, EVideoStatus } from '../types';
import { Video } from './video';
import { IVideoTask } from 'youtube-mp3-downloader';
import { isFFMpegInstalled } from '../services/ffmpeg-installer';
import { Form } from './form';
import { ButtonProgress } from './button-progress';
import { InstallFFMpeg } from './install-ffmpeg';
import { ipcRenderer } from '../services/electron-adapter';
import { AboutModal } from './about-modal';
import { PreferencesModal } from './preferences-modal/preferences-modal';

interface IMainState {
  videos: IVideoEntity[];
  inProcess: boolean;
  doneDownloading: boolean;
  isFFMpegInstalled: boolean;
  isAboutOpen: boolean;
  isPreferencesOpen: boolean;
}

class Main extends React.Component<{}, IMainState> {

  constructor(props: any) {
    super(props);

    this.state = {
      videos: [],
      inProcess: false,
      doneDownloading: false,
      isFFMpegInstalled: isFFMpegInstalled(),
      isAboutOpen: false,
      isPreferencesOpen: false,
    };
  }

  componentDidMount() {
    this.listenToDownloader();

    ipcRenderer.on('open-about', () => this.setState({
      isAboutOpen: true
    }));

    ipcRenderer.on('open-preferences', () => this.setState({
      isPreferencesOpen: true
    }));
  }

  fetchVideosClick = async (terms: string) => {
    this.setState({inProcess: true});
    const videos = await fetchVideos(terms);
    this.setState({videos, inProcess: false});
  }

  videoIndex = (videoId:  string) => {
    return this.state.videos.findIndex(v => v.id === videoId);
  }

  addToQueue = (videoId: string) => {
    const { videos } = this.state;
    const videoIndex = this.videoIndex(videoId);
    videos[videoIndex].status = EVideoStatus.PENDING;
    videos[videoIndex].progress = 0;
    console.log(videos, 'addToQueue');
    this.setState({videos});
  }

  countProgressUntil(videoIndex: number, until: number): void {
    const { videos } = this.state;
    const video = videos[videoIndex];
    const makeProgress = () => {
      const {progress, status} = video;
      if (progress === until || status !== EVideoStatus.GETTING_INFO) {
        return;
      }
      video.progress = Math.min(progress + (1 + Math.floor(Math.random() * 4)), until);
      this.setState({
        videos
      })
      setTimeout(() => {
        makeProgress()
      }, Math.random()*500);
    }
    makeProgress();
  }

  gettingInfo = (videoId: string) => {
    const { videos } = this.state;
    const videoIndex = this.videoIndex(videoId);
    videos[videoIndex].status = EVideoStatus.GETTING_INFO;
    this.countProgressUntil(videoIndex, 19);
    console.log(videos, 'gettingInfo');
    this.setState({videos});
  }

  progress = ({videoId, progress}: IVideoTask) => {
    const { videos } = this.state;
    const videoIndex = this.videoIndex(videoId);
    videos[videoIndex].status = EVideoStatus.DOWNLOADING;
    videos[videoIndex].progress = 20 + Math.floor(progress.percentage * 0.8);
    console.log(videos, 'progress');
    this.setState({videos});
  }

  finished = (err, data) => {
    const { videos } = this.state;
    const  { videoId } = data;
    const videoIndex = this.videoIndex(videoId);
    videos[videoIndex].status = EVideoStatus.DONE;
    videos[videoIndex].progress = 0;
    this.setState({videos});
    console.log('done');

    if (err) {
      alert(err);
    }
  }

  error = (err: string) => {
    alert('Sorry, something went wrong.\nPlease contact the author using "support" menu and just copy / paste the error:\n${err}\n Thanks!');
  }

  listenToDownloader() {
    return downloader
      .on('addToQueue', this.addToQueue)
      .on('gettingInfo', this.gettingInfo)
      .on('progress', this.progress)
      .on('finished', this.finished)
      .on('error', this.error);
  }

  downloadVideo = async (video: IVideoEntity) => {
    download(video.id)
  }

  downloadAll = () => {
    download(this.state.videos.map(videos => videos.id));
  }

  public render() {
    const { videos, inProcess, isFFMpegInstalled } = this.state;
    return (
      <div className="main">
        <Form
          hasResult={!!videos.length}
          onSubmit={this.fetchVideosClick}
          onClear={() => this.setState({videos: []})}
          inProcess={inProcess}
        >
          {videos.length ?
            <div>
              <ButtonProgress text="Download All" onClick={this.downloadAll} />
              <div className="videos">
                {videos.map((video, i) => (
                  <Video
                    key={video.id}
                    video={video}
                    onVideoDownloadClick={this.downloadVideo}
                    style={{
                      animationDelay: `${(i + 1) * 200}ms`
                    }}
                  />
                ))}
              </div>
            </div>
          : ''}
        </Form>
        {
          !isFFMpegInstalled && <InstallFFMpeg onDone={() => this.setState({isFFMpegInstalled: true})} />
        }
        <AboutModal open={this.state.isAboutOpen} onClose={() => this.setState({isAboutOpen: false})} />
        <PreferencesModal open={this.state.isPreferencesOpen} onClose={() => this.setState({isPreferencesOpen: false})} />
      </div>
    );
  }
}

const root = document.getElementById('app');
DOM.render(<Main />, root);